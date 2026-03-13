import { AutoRouter, cors, json, error, IRequest } from 'itty-router';
import * as cookie from 'cookie';
import { Resend } from 'resend';

export interface Env {
	DB: D1Database;
	RECAPTCHA_SECRET_KEY: string;
	RESEND_API_KEY: string;
	FRONTEND_URL: string;
}

const { preflight, corsify } = cors({
	origin: ['http://localhost:3000', 'https://manaforge-two.vercel.app'],
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
		const frontendUrl = env.FRONTEND_URL || 'http://localhost:3000';
		const activationLink = `${frontendUrl}/activate?token=${rawTokenStr}`;

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
			const frontendUrl = env.FRONTEND_URL || 'http://localhost:3000';
			const resetLink = `${frontendUrl}/reset-password?token=${rawTokenStr}`;

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

// Custom Cards: Gallery
router.post('/api/custom-cards', async (request, env: Env) => {
	try {
		console.log("Creating custom card...");
		const user = await requireAuth(request, env);
		if (!user) return error(401, 'Not authenticated');

		const { card_name, card_image } = await request.json() as any;
		if (!card_name || !card_image) return error(400, 'Missing card name or image');

		const id = crypto.randomUUID();
		await env.DB.prepare(
			`INSERT INTO custom_cards (id, user_id, card_name, card_image)
			 VALUES (?, ?, ?, ?)`
		).bind(id, user.user_id, card_name, card_image).run();

		return json({ success: true, card: { id, card_name } });
	} catch (e) {
		console.error("Create custom card error:", e);
		return error(500, 'Internal Server Error');
	}
});

// ──────────────────────────────────────────────
// Decks CRUD
// ──────────────────────────────────────────────

// Helper: require auth and return user or error response
async function requireAuth(request: IRequest, env: Env) {
	const user = await getSessionUser(request, env);
	if (!user) return null;
	return user;
}

// List all decks for the logged-in user
router.get('/api/decks', async (request, env: Env) => {
	try {
		const user = await requireAuth(request, env);
		if (!user) return error(401, 'Not authenticated');

		const { results } = await env.DB.prepare(
			`SELECT d.*, (SELECT COUNT(*) FROM deck_cards dc WHERE dc.deck_id = d.id) as card_count
			 FROM decks d
			 WHERE d.user_id = ?
			 ORDER BY d.updated_at DESC`
		).bind(user.user_id).all();

		return json({ success: true, decks: results });
	} catch (e) {
		console.error("List decks error:", e);
		return error(500, 'Internal Server Error');
	}
});

// Create a new deck
router.post('/api/decks', async (request, env: Env) => {
	try {
		const user = await requireAuth(request, env);
		if (!user) return error(401, 'Not authenticated');

		const { name, description } = await request.json() as any;

		const deckId = crypto.randomUUID();
		await env.DB.prepare(
			`INSERT INTO decks (id, user_id, name, description)
			 VALUES (?, ?, ?, ?)`
		).bind(deckId, user.user_id, name || 'Untitled Deck', description || null).run();

		return json({ success: true, deck: { id: deckId, name: name || 'Untitled Deck', description: description || null } });
	} catch (e) {
		console.error("Create deck error:", e);
		return error(500, 'Internal Server Error');
	}
});

// Get a single deck with all its cards
router.get('/api/decks/:id', async (request, env: Env) => {
	try {
		const user = await requireAuth(request, env);
		if (!user) return error(401, 'Not authenticated');

		const deckId = request.params.id;

		const deck: any = await env.DB.prepare(
			`SELECT * FROM decks WHERE id = ? AND user_id = ?`
		).bind(deckId, user.user_id).first();

		if (!deck) return error(404, 'Deck not found');

		const { results: cards } = await env.DB.prepare(
			`SELECT dc.*, cc.card_image as custom_image
			 FROM deck_cards dc
			 LEFT JOIN custom_cards cc ON dc.card_name = cc.card_name AND cc.user_id = ?
			 WHERE dc.deck_id = ?
			 ORDER BY dc.sort_order ASC, dc.created_at ASC`
		).bind(user.user_id, deckId).all();

		return json({ success: true, deck: { ...deck, cards } });
	} catch (e) {
		console.error("Get deck error:", e);
		return error(500, 'Internal Server Error');
	}
});

// Update deck metadata (name, description)
router.put('/api/decks/:id', async (request, env: Env) => {
	try {
		const user = await requireAuth(request, env);
		if (!user) return error(401, 'Not authenticated');

		const deckId = request.params.id;
		const { name, description } = await request.json() as any;

		const result = await env.DB.prepare(
			`UPDATE decks SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP
			 WHERE id = ? AND user_id = ?`
		).bind(name, description || null, deckId, user.user_id).run();

		if (result.meta.changes === 0) return error(404, 'Deck not found');

		return json({ success: true, message: 'Deck updated' });
	} catch (e) {
		console.error("Update deck error:", e);
		return error(500, 'Internal Server Error');
	}
});

// Delete a deck (cascades to cards)
router.delete('/api/decks/:id', async (request, env: Env) => {
	try {
		const user = await requireAuth(request, env);
		if (!user) return error(401, 'Not authenticated');

		const deckId = request.params.id;

		// D1 doesn't always enforce ON DELETE CASCADE, so clean up manually
		await env.DB.batch([
			env.DB.prepare(`DELETE FROM deck_cards WHERE deck_id = ?`).bind(deckId),
			env.DB.prepare(`DELETE FROM decks WHERE id = ? AND user_id = ?`).bind(deckId, user.user_id)
		]);

		return json({ success: true, message: 'Deck deleted' });
	} catch (e) {
		console.error("Delete deck error:", e);
		return error(500, 'Internal Server Error');
	}
});

// ──────────────────────────────────────────────
// Deck Cards CRUD
// ──────────────────────────────────────────────

// Bulk import cards into a deck (from a pasted decklist)
router.post('/api/decks/:id/cards', async (request, env: Env) => {
	try {
		const user = await requireAuth(request, env);
		if (!user) return error(401, 'Not authenticated');

		const deckId = request.params.id;

		// Verify deck ownership
		const deck: any = await env.DB.prepare(
			`SELECT id FROM decks WHERE id = ? AND user_id = ?`
		).bind(deckId, user.user_id).first();
		if (!deck) return error(404, 'Deck not found');

		const { cards } = await request.json() as any;
		// cards: [{ card_name: string, quantity: number }]

		if (!cards || !Array.isArray(cards) || cards.length === 0) {
			return error(400, 'No cards provided');
		}

		// Get the current max sort_order so we append after existing cards
		const maxSort: any = await env.DB.prepare(
			`SELECT COALESCE(MAX(sort_order), -1) as max_sort FROM deck_cards WHERE deck_id = ?`
		).bind(deckId).first();
		let nextSort = (maxSort?.max_sort ?? -1) + 1;

		const stmts = cards.map((card: any) => {
			const id = crypto.randomUUID();
			const stmt = env.DB.prepare(
				`INSERT INTO deck_cards (id, deck_id, card_name, quantity, sort_order)
				 VALUES (?, ?, ?, ?, ?)`
			).bind(id, deckId, card.card_name, card.quantity || 1, nextSort++);
			return stmt;
		});

		// Also touch updated_at on the deck
		stmts.push(
			env.DB.prepare(`UPDATE decks SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(deckId)
		);

		await env.DB.batch(stmts);

		return json({ success: true, message: `${cards.length} card(s) imported` });
	} catch (e) {
		console.error("Import cards error:", e);
		return error(500, 'Internal Server Error');
	}
});

// Update a single card (name, quantity, sort_order)
router.put('/api/decks/:id/cards/:cardId', async (request, env: Env) => {
	try {
		const user = await requireAuth(request, env);
		if (!user) return error(401, 'Not authenticated');

		const { id: deckId, cardId } = request.params;

		// Verify deck ownership
		const deck: any = await env.DB.prepare(
			`SELECT id FROM decks WHERE id = ? AND user_id = ?`
		).bind(deckId, user.user_id).first();
		if (!deck) return error(404, 'Deck not found');

		const { card_name, quantity, sort_order } = await request.json() as any;

		const result = await env.DB.prepare(
			`UPDATE deck_cards SET card_name = ?, quantity = ?, sort_order = ?
			 WHERE id = ? AND deck_id = ?`
		).bind(card_name, quantity, sort_order, cardId, deckId).run();

		if (result.meta.changes === 0) return error(404, 'Card not found');

		// Touch updated_at
		await env.DB.prepare(`UPDATE decks SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(deckId).run();

		return json({ success: true, message: 'Card updated' });
	} catch (e) {
		console.error("Update card error:", e);
		return error(500, 'Internal Server Error');
	}
});

// Delete a single card
router.delete('/api/decks/:id/cards/:cardId', async (request, env: Env) => {
	try {
		const user = await requireAuth(request, env);
		if (!user) return error(401, 'Not authenticated');

		const { id: deckId, cardId } = request.params;

		// Verify deck ownership
		const deck: any = await env.DB.prepare(
			`SELECT id FROM decks WHERE id = ? AND user_id = ?`
		).bind(deckId, user.user_id).first();
		if (!deck) return error(404, 'Deck not found');

		const result = await env.DB.prepare(
			`DELETE FROM deck_cards WHERE id = ? AND deck_id = ?`
		).bind(cardId, deckId).run();

		if (result.meta.changes === 0) return error(404, 'Card not found');

		// Touch updated_at
		await env.DB.prepare(`UPDATE decks SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(deckId).run();

		return json({ success: true, message: 'Card deleted' });
	} catch (e) {
		console.error("Delete card error:", e);
		return error(500, 'Internal Server Error');
	}
});

// ──────────────────────────────────────────────
// Players CRUD
// ──────────────────────────────────────────────

router.get('/api/players', async (request, env: Env) => {
	const user = await getSessionUser(request, env);
	if (!user) return error(401, 'Unauthorized');

	const { results } = await env.DB.prepare(
		`SELECT * FROM players ORDER BY name ASC`
	).all();

	return json({ success: true, players: results });
});

router.post('/api/players', async (request, env: Env) => {
	const user = await getSessionUser(request, env);
	if (!user) return error(401, 'Unauthorized');

	try {
		const { name, dob, country, email } = await request.json() as any;
		if (!name) return error(400, 'Name is required');

		const id = crypto.randomUUID();
		await env.DB.prepare(
			`INSERT INTO players (id, name, dob, country, email)
			 VALUES (?, ?, ?, ?, ?)`
		).bind(id, name, dob || null, country || null, email || null).run();

		return json({ success: true, player: { id, name, dob, country, email } });
	} catch (e: any) {
		return error(500, e.message);
	}
});

router.put('/api/players/:id', async (request, env: Env) => {
	const user = await getSessionUser(request, env);
	if (!user) return error(401, 'Unauthorized');

	const { id } = request.params;
	try {
		const { name, dob, country, email } = await request.json() as any;
		await env.DB.prepare(
			`UPDATE players SET name = ?, dob = ?, country = ?, email = ? WHERE id = ?`
		).bind(name, dob || null, country || null, email || null, id).run();

		return json({ success: true });
	} catch (e: any) {
		return error(500, e.message);
	}
});

router.delete('/api/players/:id', async (request, env: Env) => {
	const user = await getSessionUser(request, env);
	if (!user) return error(401, 'Unauthorized');

	const { id } = request.params;
	await env.DB.prepare(`DELETE FROM players WHERE id = ?`).bind(id).run();
	return json({ success: true });
});

// ──────────────────────────────────────────────
// Tournaments CRUD
// ──────────────────────────────────────────────

router.get('/api/tournaments', async (request, env: Env) => {
	const user = await getSessionUser(request, env);
	if (!user) return error(401, 'Unauthorized');

	const { results } = await env.DB.prepare(
		`SELECT * FROM tournaments ORDER BY start_date DESC`
	).all();

	return json({ success: true, tournaments: results });
});

router.get('/api/tournaments/:id', async (request, env: Env) => {
	const user = await getSessionUser(request, env);
	if (!user) return error(401, 'Unauthorized');

	const { id } = request.params;
	const tournament = await env.DB.prepare(
		`SELECT * FROM tournaments WHERE id = ?`
	).bind(id).first();

	if (!tournament) return error(404, 'Tournament not found');

	return json({ success: true, tournament });
});

router.post('/api/tournaments', async (request, env: Env) => {
	const user = await getSessionUser(request, env);
	if (!user) return error(401, 'Unauthorized');

	try {
		const { name, start_date, end_date, location, num_tables, format, status } = await request.json() as any;
		if (!name || !start_date || !end_date) return error(400, 'Name, Start Date, and End Date are required');

		const id = crypto.randomUUID();
		await env.DB.prepare(
			`INSERT INTO tournaments (id, name, start_date, end_date, location, num_tables, format, status)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
		).bind(id, name, start_date, end_date, location || null, num_tables || 0, format || null, status || 'draft').run();

		return json({ success: true, tournament: { id, name, start_date, end_date, location, num_tables, format, status: status || 'draft' } });
	} catch (e: any) {
		return error(500, e.message);
	}
});

router.put('/api/tournaments/:id', async (request, env: Env) => {
	const user = await getSessionUser(request, env);
	if (!user) return error(401, 'Unauthorized');

	const { id } = request.params;
	try {
		const { name, start_date, end_date, location, num_tables, format, status } = await request.json() as any;
		await env.DB.prepare(
			`UPDATE tournaments SET name = ?, start_date = ?, end_date = ?, location = ?, num_tables = ?, format = ?, status = ? WHERE id = ?`
		).bind(name, start_date, end_date, location || null, num_tables || 0, format || null, status || 'draft', id).run();

		return json({ success: true });
	} catch (e: any) {
		return error(500, e.message);
	}
});

router.delete('/api/tournaments/:id', async (request, env: Env) => {
	const user = await getSessionUser(request, env);
	if (!user) return error(401, 'Unauthorized');

	const { id } = request.params;
	await env.DB.prepare(`DELETE FROM tournaments WHERE id = ?`).bind(id).run();
	return json({ success: true });
});

// ──────────────────────────────────────────────
// Tournament Registrations & Standings
// ──────────────────────────────────────────────

router.get('/api/tournaments/:id/registrations', async (request, env: Env) => {
	const user = await getSessionUser(request, env);
	if (!user) return error(401, 'Unauthorized');

	const { id } = request.params;
	const { results } = await env.DB.prepare(
		`SELECT tr.*, p.name as player_name, d.name as deck_name 
		 FROM tournament_registrations tr
		 JOIN players p ON tr.player_id = p.id
		 LEFT JOIN decks d ON tr.deck_id = d.id
		 WHERE tr.tournament_id = ?
		 ORDER BY tr.points DESC, tr.wins DESC`
	).bind(id).all();

	return json({ success: true, registrations: results });
});

router.post('/api/tournaments/:id/registrations', async (request, env: Env) => {
	const user = await getSessionUser(request, env);
	if (!user) return error(401, 'Unauthorized');

	const { id: tournamentId } = request.params;
	try {
		const { player_id, deck_id } = await request.json() as any;
		if (!player_id) return error(400, 'Player ID is required');

		const id = crypto.randomUUID();
		await env.DB.prepare(
			`INSERT INTO tournament_registrations (id, tournament_id, player_id, deck_id)
			 VALUES (?, ?, ?, ?)`
		).bind(id, tournamentId, player_id, deck_id || null).run();

		return json({ success: true, registration: { id, tournament_id: tournamentId, player_id, deck_id } });
	} catch (e: any) {
		return error(500, e.message);
	}
});

router.put('/api/tournaments/:tournamentId/registrations/:id', async (request, env: Env) => {
	const user = await getSessionUser(request, env);
	if (!user) return error(401, 'Unauthorized');

	const { id } = request.params;
	try {
		const { deck_id, points, wins, losses, draws, dropped } = await request.json() as any;
		await env.DB.prepare(
			`UPDATE tournament_registrations 
			 SET deck_id = ?, points = ?, wins = ?, losses = ?, draws = ?, dropped = ? 
			 WHERE id = ?`
		).bind(deck_id || null, points || 0, wins || 0, losses || 0, draws || 0, dropped ? 1 : 0, id).run();

		return json({ success: true });
	} catch (e: any) {
		return error(500, e.message);
	}
});

router.delete('/api/tournaments/:tournamentId/registrations/:id', async (request, env: Env) => {
	const user = await getSessionUser(request, env);
	if (!user) return error(401, 'Unauthorized');

	const { id } = request.params;
	await env.DB.prepare(`DELETE FROM tournament_registrations WHERE id = ?`).bind(id).run();
	return json({ success: true });
});

// ──────────────────────────────────────────────
// Matches
// ──────────────────────────────────────────────

router.get('/api/tournaments/:id/matches', async (request, env: Env) => {
	const user = await getSessionUser(request, env);
	if (!user) return error(401, 'Unauthorized');

	const { id } = request.params;
	const { results } = await env.DB.prepare(
		`SELECT m.*, p1.name as p1_name, p2.name as p2_name 
		 FROM matches m
		 JOIN players p1 ON m.p1_id = p1.id
		 JOIN players p2 ON m.p2_id = p2.id
		 WHERE m.tournament_id = ?
		 ORDER BY m.round_number DESC, m.table_number ASC`
	).bind(id).all();

	return json({ success: true, matches: results });
});

router.post('/api/tournaments/:id/pairings', async (request, env: Env) => {
	const user = await getSessionUser(request, env);
	if (!user) return error(401, 'Unauthorized');

	const { id: tournamentId } = request.params;
	try {
		// 1. Get active players
		const { results: registrations } = await env.DB.prepare(
			`SELECT player_id FROM tournament_registrations WHERE tournament_id = ? AND dropped = 0`
		).bind(tournamentId).all();

		if (registrations.length < 2) {
			return error(400, 'Need at least 2 players to generate rounds');
		}

		// 2. Determine round number
		const lastMatch = await env.DB.prepare(
			`SELECT MAX(round_number) as last_round FROM matches WHERE tournament_id = ?`
		).bind(tournamentId).first();
		const roundNumber = ((lastMatch?.last_round as number) || 0) + 1;

		// 3. Shuffle players (Fisher-Yates)
		const playerIds = registrations.map((r: any) => r.player_id);
		for (let i = playerIds.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[playerIds[i], playerIds[j]] = [playerIds[j], playerIds[i]];
		}

		// 4. Create matches
		const matches = [];
		let tableNumber = 1;
		for (let i = 0; i < playerIds.length; i += 2) {
			const p1 = playerIds[i];
			const p2 = playerIds[i + 1] || 'tobias-boon'; // Tobias Boon handles the bye
			
			matches.push({
				id: crypto.randomUUID(),
				tournament_id: tournamentId,
				round_number: roundNumber,
				p1_id: p1,
				p2_id: p2,
				table_number: tableNumber++,
				status: 'pending'
			});
		}

		// 5. Batch insert
		const statements = matches.map(m => 
			env.DB.prepare(
				`INSERT INTO matches (id, tournament_id, round_number, p1_id, p2_id, table_number, status)
				 VALUES (?, ?, ?, ?, ?, ?, ?)`
			).bind(m.id, m.tournament_id, m.round_number, m.p1_id, m.p2_id, m.table_number, m.status)
		);

		await env.DB.batch(statements);

		return json({ success: true, count: matches.length, round: roundNumber });
	} catch (e: any) {
		return error(500, e.message);
	}
});

router.post('/api/tournaments/:id/matches', async (request, env: Env) => {
	const user = await getSessionUser(request, env);
	if (!user) return error(401, 'Unauthorized');

	const { id: tournamentId } = request.params;
	try {
		const { round_number, p1_id, p2_id, table_number } = await request.json() as any;
		if (!round_number || !p1_id || !p2_id) return error(400, 'Round Number, Player 1 ID, and Player 2 ID are required');

		const id = crypto.randomUUID();
		await env.DB.prepare(
			`INSERT INTO matches (id, tournament_id, round_number, p1_id, p2_id, table_number, status)
			 VALUES (?, ?, ?, ?, ?, ?, 'pending')`
		).bind(id, tournamentId, round_number, p1_id, p2_id, table_number || null).run();

		return json({ success: true, match: { id, tournament_id: tournamentId, round_number, p1_id, p2_id, table_number, status: 'pending' } });
	} catch (e: any) {
		return error(500, e.message);
	}
});

router.put('/api/tournaments/:tournamentId/matches/:id', async (request, env: Env) => {
	const user = await getSessionUser(request, env);
	if (!user) return error(401, 'Unauthorized');

	const { id } = request.params;
	try {
		const { p1_score, p2_score, draws, status, table_number, scheduled_at } = await request.json() as any;
		await env.DB.prepare(
			`UPDATE matches 
			 SET p1_score = ?, p2_score = ?, draws = ?, status = ?, table_number = ?, scheduled_at = ? 
			 WHERE id = ?`
		).bind(
			p1_score || 0, 
			p2_score || 0, 
			draws || 0, 
			status || 'pending', 
			table_number || null, 
			scheduled_at || null, 
			id
		).run();

		return json({ success: true });
	} catch (e: any) {
		return error(500, e.message);
	}
});

router.delete('/api/tournaments/:tournamentId/matches/:id', async (request, env: Env) => {
	const user = await getSessionUser(request, env);
	if (!user) return error(401, 'Unauthorized');

	const { id } = request.params;
	await env.DB.prepare(`DELETE FROM matches WHERE id = ?`).bind(id).run();
	return json({ success: true });
});



// ──────────────────────────────────────────────
// Share Links (Refactored)
// ──────────────────────────────────────────────
// Update existing handlers to use deck_id and decks table
// ... these will be fully implemented in the next phase, but the schema assumes deck_id now.

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
