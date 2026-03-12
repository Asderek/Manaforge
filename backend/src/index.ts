import { AutoRouter, cors, json, error, IRequest } from 'itty-router';
import * as cookie from 'cookie';
import { Resend } from 'resend';

export interface Env {
	DB: D1Database;
	RECAPTCHA_SECRET_KEY: string;
	RESEND_API_KEY: string;
}

const { preflight, corsify } = cors({
	origin: ['http://localhost:3000', 'https://manaforge.example', 'https://lucas.github.io'],
	allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
	credentials: true,
});
const router = AutoRouter({
	before: [preflight],
	finally: [corsify],
});

// Utility function to hash passwords (SHA-256 for Workers)
async function hashPassword(password: string): Promise<string> {
	const msgBuffer = new TextEncoder().encode(password);
	const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Utility function to check and get the current user session
async function getSessionUser(request: IRequest, env: Env) {
	const cookieHeader = request.headers.get('Cookie');
	if (!cookieHeader) return null;

	const cookies = cookie.parse(cookieHeader);
	const sessionId = cookies['session_id'];
	if (!sessionId) return null;

	const sessionInfo: any = await env.DB.prepare(
		`SELECT s.id, s.user_id, u.email, u.display_name, u.role
		 FROM sessions s
		 JOIN users u ON s.user_id = u.id
		 WHERE s.id = ? AND s.expires_at > CURRENT_TIMESTAMP AND s.revoked_at IS NULL`
	).bind(sessionId).first();

	return sessionInfo || null;
}

router.get('/api/health', () => {
	return json({ status: 'ok', service: 'manaforge-backend' });
});

router.post('/api/auth/register-request', async (request, env: Env) => {
	try {
		const body = await request.json();
		const { email, displayName, note, recaptchaToken } = body as any;

		if (!email || !displayName || !recaptchaToken) {
			return error(400, 'Missing required fields');
		}

		// Verify reCAPTCHA token
		const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${env.RECAPTCHA_SECRET_KEY}&response=${recaptchaToken}`;
		const recaptchaRes = await fetch(verifyUrl, { method: 'POST' });
		const recaptchaData: any = await recaptchaRes.json();

		if (!recaptchaData.success) {
			return error(400, 'Invalid reCAPTCHA token');
		}

		// Generate a simple UUID-like ID for the request
		const requestId = crypto.randomUUID();

		// Insert into D1
		await env.DB.prepare(
			`INSERT INTO registration_requests (id, email, display_name, note, recaptcha_checked_at, status)
			 VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, 'pending')`
		).bind(requestId, email, displayName, note || null).run();

		// Send "Received" email
		await sendEmailAndUpdateLog(
			env,
			email,
			"Registration Request Received",
			`<h1>Welcome to Mana Forge!</h1><p>We've received your registration request for ${displayName}. An administrator will review your account shortly.</p>`
		);

		return json({ success: true, message: 'Registration request received and pending approval.' });
	} catch (e: any) {
		// Log the error for debugging purposes in the CF dashboard
		console.error("Registration error:", e);

		// If it's a constraint failure (UNIQUE email), return a generic but helpful error
		if (e.message && e.message.includes('UNIQUE constraint failed')) {
			return error(409, 'A request for this email already exists.');
		}

		return error(500, 'Internal Server Error');
	}
});

// Auth: Login
router.post('/api/auth/login', async (request, env: Env) => {
	try {
		const { email, password } = await request.json() as any;
		if (!email || !password) return error(400, 'Missing email or password');

		// 1. Find user
		const user: any = await env.DB.prepare(
			`SELECT * FROM users WHERE email = ? AND status = 'active'`
		).bind(email).first();

		if (!user) return error(401, 'Invalid credentials or inactive account');

		// 2. Verify password (simple hash check for now)
		const hashedInput = await hashPassword(password);
		if (user.password_hash !== hashedInput) return error(401, 'Invalid credentials');

		// 3. Create session
		const sessionId = crypto.randomUUID();
		await env.DB.prepare(
			`INSERT INTO sessions (id, user_id, expires_at)
			 VALUES (?, ?, datetime('now', '+7 days'))`
		).bind(sessionId, user.id).run();

		// 4. Set cookie
		const serializedCookie = cookie.serialize('session_id', sessionId, {
			httpOnly: true,
			secure: true,
			sameSite: 'none',
			maxAge: 60 * 60 * 24 * 7, // 1 week
			path: '/'
		});

		return new Response(JSON.stringify({ success: true, user: { id: user.id, email: user.email, display_name: user.display_name, role: user.role } }), {
			headers: {
				'Content-Type': 'application/json',
				'Set-Cookie': serializedCookie
			}
		});
	} catch (e) {
		console.error("Login error:", e);
		return error(500, 'Internal Server Error');
	}
});

// Auth: Me (Session validation)
router.get('/api/auth/me', async (request, env: Env) => {
	try {
		const user = await getSessionUser(request, env);
		if (!user) return error(401, 'Not authenticated');

		return json({ success: true, user: { id: user.user_id, email: user.email, display_name: user.display_name, role: user.role } });
	} catch (e) {
		return error(500, 'Internal Server Error');
	}
});

// Auth: Logout
router.post('/api/auth/logout', async (request, env: Env) => {
	try {
		const cookieHeader = request.headers.get('Cookie');
		if (cookieHeader) {
			const cookies = cookie.parse(cookieHeader);
			const sessionId = cookies['session_id'];

			if (sessionId) {
				await env.DB.prepare(`UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(sessionId).run();
			}
		}

		// Clear cookie
		const serializedCookie = cookie.serialize('session_id', '', {
			httpOnly: true,
			secure: true,
			sameSite: 'none',
			maxAge: 0,
			path: '/'
		});

		return new Response(JSON.stringify({ success: true }), {
			headers: {
				'Content-Type': 'application/json',
				'Set-Cookie': serializedCookie
			}
		});
	} catch (e) {
		return error(500, 'Internal Server Error');
	}
});

// Admin: List pending requests
router.get('/api/admin/registration-requests', async (request, env: Env) => {
	try {
		const { results } = await env.DB.prepare(
			`SELECT * FROM registration_requests ORDER BY recaptcha_checked_at DESC`
		).all();

		return json({ success: true, requests: results });
	} catch (e) {
		return error(500, 'Failed to fetch requests');
	}
});

// Admin: Approve request
router.post('/api/admin/registration-requests/:id/approve', async (request, env: Env) => {
	try {
		const requestId = request.params.id;
		// HARDCODED admin ID for now until sessions are built
		const adminId = 'usr_admin123';

		// 1. Mark request as approved
		const updateResult = await env.DB.prepare(
			`UPDATE registration_requests 
			 SET status = 'approved', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP 
			 WHERE id = ? AND status = 'pending'`
		).bind(adminId, requestId).run();

		if (updateResult.meta.changes === 0) {
			return error(404, 'Request not found or already reviewed');
		}

		// 2. Fetch the request details to get the email
		const pendingRequest: any = await env.DB.prepare(
			`SELECT * FROM registration_requests WHERE id = ?`
		).bind(requestId).first();

		// 3. Create the actual User record securely
		const newUserId = crypto.randomUUID();
		await env.DB.prepare(
			`INSERT INTO users (id, email, display_name, role, status)
			 VALUES (?, ?, ?, 'user', 'active')`
		).bind(newUserId, pendingRequest.email, pendingRequest.display_name).run();

		// 4. Generate the Activation Token (Un-hashed version is emailed to the user, hash stays in the DB)
		// We securely generate 64 random bytes, then convert to hex string
		const rawTokenBuffer = new Uint8Array(64);
		crypto.getRandomValues(rawTokenBuffer);
		const rawTokenStr = Array.from(rawTokenBuffer).map(b => b.toString(16).padStart(2, '0')).join('');

		const hashedTokenStr = await hashPassword(rawTokenStr); // Use the same SHA-256 process since it generates one-way strings

		const tokenId = crypto.randomUUID();
		await env.DB.prepare(
			`INSERT INTO email_tokens (id, user_id, token_hash, expires_at)
			 VALUES (?, ?, ?, datetime('now', '+3 days'))`
		).bind(tokenId, newUserId, hashedTokenStr).run();

		// 5. Send activation email containing the secret link
		const activationLink = `http://localhost:3000/activate?token=${rawTokenStr}`; // TODO: env variable for frontend URL

		await sendEmailAndUpdateLog(
			env,
			pendingRequest.email,
			"Your Registration is Approved!",
			`<h1>Welcome to Mana Forge!</h1>
			 <p>Your administrator has approved your registration. You must set your password to activate your account.</p>
			 <p><a href="${activationLink}">Click here to activate your account</a></p>
			 <p><i>This link will expire in 72 hours.</i></p>`
		);

		return json({ success: true, message: 'Request approved and email sent' });
	} catch (e) {
		console.error("Approval error:", e);
		return error(500, 'Internal Server Error');
	}
});

// Admin: Delete request (Hard delete so user can reuse email instantly)
router.delete('/api/admin/registration-requests/:id', async (request, env: Env) => {
	try {
		const requestId = request.params.id;

		const pendingRequest: any = await env.DB.prepare(
			`SELECT email FROM registration_requests WHERE id = ?`
		).bind(requestId).first();

		if (!pendingRequest) {
			return error(404, 'Request not found');
		}

		// If the user was already created from this request, we must delete them to free up the email.
		const user: any = await env.DB.prepare(`SELECT id, role FROM users WHERE email = ?`).bind(pendingRequest.email).first();
		if (user && user.role !== 'admin') {
			// Clean up any linked tokens, sessions, and the user record
			await env.DB.batch([
				env.DB.prepare(`DELETE FROM email_tokens WHERE user_id = ?`).bind(user.id),
				env.DB.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(user.id),
				env.DB.prepare(`DELETE FROM users WHERE id = ?`).bind(user.id)
			]);
		}

		// Finally, delete the request record itself
		await env.DB.prepare(`DELETE FROM registration_requests WHERE id = ?`).bind(requestId).run();

		return json({ success: true, message: 'Request and related user data deleted successfully' });
	} catch (e) {
		console.error("Delete error:", e);
		return error(500, 'Internal Server Error');
	}
});

// Auth: Activate Account (Verify Token & Set Password)
router.post('/api/auth/activate', async (request, env: Env) => {
	try {
		const { token, password } = await request.json() as any;
		if (!token || !password) return error(400, 'Missing token or password');

		if (password.length < 8) return error(400, 'Password must be at least 8 characters');

		const hashedTokenStr = await hashPassword(token);

		// 1. Find valid token
		const activeToken: any = await env.DB.prepare(
			`SELECT t.*, u.email, u.display_name 
			 FROM email_tokens t
			 JOIN users u ON t.user_id = u.id
			 WHERE t.token_hash = ? AND t.used_at IS NULL AND t.expires_at > CURRENT_TIMESTAMP`
		).bind(hashedTokenStr).first();

		if (!activeToken) return error(400, 'Invalid or expired activation link');

		// 2. Hash new password
		const newPasswordHash = await hashPassword(password);

		// 3. Perform the update transactions
		const batch = await env.DB.batch([
			// Update the user's password
			env.DB.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).bind(newPasswordHash, activeToken.user_id),
			// Mark token as used
			env.DB.prepare(`UPDATE email_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(activeToken.id)
		]);

		return json({ success: true, message: 'Account activated successfully. You can now log in.' });
	} catch (e) {
		console.error("Activation error:", e);
		return error(500, 'Internal Server Error');
	}
});

// Auth: Forgot Password (Generate Token & Send Email)
router.post('/api/auth/forgot-password', async (request, env: Env) => {
	try {
		const { email } = await request.json() as any;
		if (!email) return error(400, 'Missing email');

		// 1. Check if user exists (fail silently if not to prevent email enumeration)
		const user: any = await env.DB.prepare(
			`SELECT id, display_name FROM users WHERE email = ? AND status = 'active'`
		).bind(email).first();

		if (user) {
			// 2. Generate secure token
			const rawTokenBuffer = new Uint8Array(64);
			crypto.getRandomValues(rawTokenBuffer);
			const rawTokenStr = Array.from(rawTokenBuffer).map(b => b.toString(16).padStart(2, '0')).join('');
			const hashedTokenStr = await hashPassword(rawTokenStr);
			const tokenId = crypto.randomUUID();

			// 3. Store Token (Valid for 24 hours)
			await env.DB.prepare(
				`INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at)
				 VALUES (?, ?, ?, datetime('now', '+1 day'))`
			).bind(tokenId, user.id, hashedTokenStr).run();

			// 4. Send Email
			const resetLink = `http://localhost:3000/reset-password?token=${rawTokenStr}`;

			await sendEmailAndUpdateLog(
				env,
				email,
				"Password Reset Request",
				`<h1>Mana Forge Password Reset</h1>
				 <p>Hi ${user.display_name},</p>
				 <p>We received a request to reset your password. Click the link below to set a new one:</p>
				 <p><a href="${resetLink}">Reset My Password</a></p>
				 <p><i>This link will expire in 24 hours. If you did not request this, please ignore this email.</i></p>`
			);
		}

		// Always return success even if user doesn't exist
		return json({ success: true, message: 'If an account exists, a reset link has been sent.' });

	} catch (e) {
		console.error("Forgot password error:", e);
		return error(500, 'Internal Server Error');
	}
});

// Auth: Reset Password (Verify Token & Update)
router.post('/api/auth/reset-password', async (request, env: Env) => {
	try {
		const { token, password } = await request.json() as any;
		if (!token || !password) return error(400, 'Missing token or password');

		if (password.length < 8) return error(400, 'Password must be at least 8 characters');

		const hashedTokenStr = await hashPassword(token);

		// 1. Find valid token
		const activeToken: any = await env.DB.prepare(
			`SELECT t.*, u.id as u_id
			 FROM password_reset_tokens t
			 JOIN users u ON t.user_id = u.id
			 WHERE t.token_hash = ? AND t.used_at IS NULL AND t.expires_at > CURRENT_TIMESTAMP`
		).bind(hashedTokenStr).first();

		if (!activeToken) return error(400, 'Invalid or expired password reset link');

		// 2. Hash new password
		const newPasswordHash = await hashPassword(password);

		// 3. Update DB
		const batch = await env.DB.batch([
			env.DB.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).bind(newPasswordHash, activeToken.u_id),
			env.DB.prepare(`UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(activeToken.id),
			// Proactively revoke active sessions for security
			env.DB.prepare(`UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL`).bind(activeToken.u_id)
		]);

		return json({ success: true, message: 'Password has been successfully reset. You can now log in.' });
	} catch (e) {
		console.error("Reset password error:", e);
		return error(500, 'Internal Server Error');
	}
});

// ──────────────────────────────────────────────
// Projects CRUD
// ──────────────────────────────────────────────

// Helper: require auth and return user or error response
async function requireAuth(request: IRequest, env: Env) {
	const user = await getSessionUser(request, env);
	if (!user) return null;
	return user;
}

// List all projects for the logged-in user
router.get('/api/projects', async (request, env: Env) => {
	try {
		const user = await requireAuth(request, env);
		if (!user) return error(401, 'Not authenticated');

		const { results } = await env.DB.prepare(
			`SELECT p.*, (SELECT COUNT(*) FROM project_cards pc WHERE pc.project_id = p.id) as card_count
			 FROM projects p
			 WHERE p.user_id = ?
			 ORDER BY p.updated_at DESC`
		).bind(user.user_id).all();

		return json({ success: true, projects: results });
	} catch (e) {
		console.error("List projects error:", e);
		return error(500, 'Internal Server Error');
	}
});

// Create a new project
router.post('/api/projects', async (request, env: Env) => {
	try {
		const user = await requireAuth(request, env);
		if (!user) return error(401, 'Not authenticated');

		const { name, description } = await request.json() as any;

		const projectId = crypto.randomUUID();
		await env.DB.prepare(
			`INSERT INTO projects (id, user_id, name, description)
			 VALUES (?, ?, ?, ?)`
		).bind(projectId, user.user_id, name || 'Untitled Deck', description || null).run();

		return json({ success: true, project: { id: projectId, name: name || 'Untitled Deck', description: description || null } });
	} catch (e) {
		console.error("Create project error:", e);
		return error(500, 'Internal Server Error');
	}
});

// Get a single project with all its cards
router.get('/api/projects/:id', async (request, env: Env) => {
	try {
		const user = await requireAuth(request, env);
		if (!user) return error(401, 'Not authenticated');

		const projectId = request.params.id;

		const project: any = await env.DB.prepare(
			`SELECT * FROM projects WHERE id = ? AND user_id = ?`
		).bind(projectId, user.user_id).first();

		if (!project) return error(404, 'Project not found');

		const { results: cards } = await env.DB.prepare(
			`SELECT * FROM project_cards WHERE project_id = ? ORDER BY sort_order ASC, created_at ASC`
		).bind(projectId).all();

		return json({ success: true, project: { ...project, cards } });
	} catch (e) {
		console.error("Get project error:", e);
		return error(500, 'Internal Server Error');
	}
});

// Update project metadata (name, description)
router.put('/api/projects/:id', async (request, env: Env) => {
	try {
		const user = await requireAuth(request, env);
		if (!user) return error(401, 'Not authenticated');

		const projectId = request.params.id;
		const { name, description } = await request.json() as any;

		const result = await env.DB.prepare(
			`UPDATE projects SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP
			 WHERE id = ? AND user_id = ?`
		).bind(name, description || null, projectId, user.user_id).run();

		if (result.meta.changes === 0) return error(404, 'Project not found');

		return json({ success: true, message: 'Project updated' });
	} catch (e) {
		console.error("Update project error:", e);
		return error(500, 'Internal Server Error');
	}
});

// Delete a project (cascades to cards)
router.delete('/api/projects/:id', async (request, env: Env) => {
	try {
		const user = await requireAuth(request, env);
		if (!user) return error(401, 'Not authenticated');

		const projectId = request.params.id;

		// D1 doesn't always enforce ON DELETE CASCADE, so clean up manually
		await env.DB.batch([
			env.DB.prepare(`DELETE FROM project_cards WHERE project_id = ?`).bind(projectId),
			env.DB.prepare(`DELETE FROM projects WHERE id = ? AND user_id = ?`).bind(projectId, user.user_id)
		]);

		return json({ success: true, message: 'Project deleted' });
	} catch (e) {
		console.error("Delete project error:", e);
		return error(500, 'Internal Server Error');
	}
});

// ──────────────────────────────────────────────
// Project Cards CRUD
// ──────────────────────────────────────────────

// Bulk import cards into a project (from a pasted decklist)
router.post('/api/projects/:id/cards', async (request, env: Env) => {
	try {
		const user = await requireAuth(request, env);
		if (!user) return error(401, 'Not authenticated');

		const projectId = request.params.id;

		// Verify project ownership
		const project: any = await env.DB.prepare(
			`SELECT id FROM projects WHERE id = ? AND user_id = ?`
		).bind(projectId, user.user_id).first();
		if (!project) return error(404, 'Project not found');

		const { cards } = await request.json() as any;
		// cards: [{ card_name: string, quantity: number }]

		if (!cards || !Array.isArray(cards) || cards.length === 0) {
			return error(400, 'No cards provided');
		}

		// Get the current max sort_order so we append after existing cards
		const maxSort: any = await env.DB.prepare(
			`SELECT COALESCE(MAX(sort_order), -1) as max_sort FROM project_cards WHERE project_id = ?`
		).bind(projectId).first();
		let nextSort = (maxSort?.max_sort ?? -1) + 1;

		const stmts = cards.map((card: any) => {
			const id = crypto.randomUUID();
			const stmt = env.DB.prepare(
				`INSERT INTO project_cards (id, project_id, card_name, quantity, sort_order)
				 VALUES (?, ?, ?, ?, ?)`
			).bind(id, projectId, card.card_name, card.quantity || 1, nextSort++);
			return stmt;
		});

		// Also touch updated_at on the project
		stmts.push(
			env.DB.prepare(`UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(projectId)
		);

		await env.DB.batch(stmts);

		return json({ success: true, message: `${cards.length} card(s) imported` });
	} catch (e) {
		console.error("Import cards error:", e);
		return error(500, 'Internal Server Error');
	}
});

// Update a single card (name, quantity, sort_order)
router.put('/api/projects/:id/cards/:cardId', async (request, env: Env) => {
	try {
		const user = await requireAuth(request, env);
		if (!user) return error(401, 'Not authenticated');

		const { id: projectId, cardId } = request.params;

		// Verify project ownership
		const project: any = await env.DB.prepare(
			`SELECT id FROM projects WHERE id = ? AND user_id = ?`
		).bind(projectId, user.user_id).first();
		if (!project) return error(404, 'Project not found');

		const { card_name, quantity, sort_order } = await request.json() as any;

		const result = await env.DB.prepare(
			`UPDATE project_cards SET card_name = ?, quantity = ?, sort_order = ?
			 WHERE id = ? AND project_id = ?`
		).bind(card_name, quantity, sort_order, cardId, projectId).run();

		if (result.meta.changes === 0) return error(404, 'Card not found');

		// Touch updated_at
		await env.DB.prepare(`UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(projectId).run();

		return json({ success: true, message: 'Card updated' });
	} catch (e) {
		console.error("Update card error:", e);
		return error(500, 'Internal Server Error');
	}
});

// Delete a single card
router.delete('/api/projects/:id/cards/:cardId', async (request, env: Env) => {
	try {
		const user = await requireAuth(request, env);
		if (!user) return error(401, 'Not authenticated');

		const { id: projectId, cardId } = request.params;

		// Verify project ownership
		const project: any = await env.DB.prepare(
			`SELECT id FROM projects WHERE id = ? AND user_id = ?`
		).bind(projectId, user.user_id).first();
		if (!project) return error(404, 'Project not found');

		const result = await env.DB.prepare(
			`DELETE FROM project_cards WHERE id = ? AND project_id = ?`
		).bind(cardId, projectId).run();

		if (result.meta.changes === 0) return error(404, 'Card not found');

		// Touch updated_at
		await env.DB.prepare(`UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(projectId).run();

		return json({ success: true, message: 'Card deleted' });
	} catch (e) {
		console.error("Delete card error:", e);
		return error(500, 'Internal Server Error');
	}
});

// Utility function to send an email and log it to D1
async function sendEmailAndUpdateLog(env: Env, to: string, subject: string, html: string) {
	const resend = new Resend(env.RESEND_API_KEY);
	let logStatus = 'sent';
	let errorMessage = null;

	try {
		const result = await resend.emails.send({
			from: 'Mana Forge <onboarding@resend.dev>', // Resend's free testing domain
			to,
			subject,
			html,
		});

		if (result.error) {
			logStatus = 'failed';
			errorMessage = result.error.message;
			console.error("Resend API true error:", result.error);
		}
	} catch (e: any) {
		logStatus = 'failed';
		errorMessage = e.message;
		console.error("Resend delivery exception:", e);
	}

	// 2. Log exactly what happened in D1
	try {
		await env.DB.prepare(
			`INSERT INTO email_log (id, recipient_email, subject, status, error_message)
			 VALUES (?, ?, ?, ?, ?)`
		).bind(crypto.randomUUID(), to, subject, logStatus, errorMessage).run();
	} catch (dbErr) {
		console.error("Failed to write to email_log:", dbErr);
	}

	return logStatus === 'sent';
}

export default {
	fetch: router.fetch,
} satisfies ExportedHandler<Env>;
