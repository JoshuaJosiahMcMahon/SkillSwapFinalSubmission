import { AuthService } from '../services/AuthService.js';

export class AuthController {
    async register(req, res, router) {
        try {
            const { firstName, lastName, email, password, confirmPassword, isTutor, blockName, bio, major, yearOfStudy } = req.body;

            if (!firstName || !lastName || !email || !password || !blockName) {
                return router.sendJson(res, {
                    success: false,
                    error: 'First name, last name, email, password, and block name are required'
                }, 400);
            }

            if (password !== confirmPassword) {
                return router.sendJson(res, {
                    success: false,
                    error: 'Passwords do not match'
                }, 400);
            }

            if (password.length < 6) {
                return router.sendJson(res, {
                    success: false,
                    error: 'Password must be at least 6 characters'
                }, 400);
            }

            const result = await AuthService.register({
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                email,
                password,
                isTutor: isTutor === true || isTutor === 'true',
                blockName,
                bio,
                major,
                yearOfStudy: yearOfStudy ? parseInt(yearOfStudy) : null
            });

            if (!result.success) {
                return router.sendJson(res, result, 400);
            }

            const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            res.setHeader('Set-Cookie', [
                `sessionId=${result.user.id}; Path=/; SameSite=Lax; Expires=${expires.toUTCString()}`,
                `sessionToken=${result.token}; Path=/; SameSite=Lax; Expires=${expires.toUTCString()}`
            ]);
            router.sendJson(res, result);
        } catch (error) {
            router.sendJson(res, {
                success: false,
                error: 'An error occurred during registration'
            }, 500);
        }
    }

    async login(req, res, router) {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return router.sendJson(res, {
                    success: false,
                    error: 'Email and password are required'
                }, 400);
            }

            const result = await AuthService.login(email, password);

            if (!result.success) {

                if (result.banned) {
                    return router.sendJson(res, {
                        success: false,
                        error: result.error,
                        banned: true,
                        banReason: result.banReason
                    }, 403);
                }
                return router.sendJson(res, result, 401);
            }

            const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            res.setHeader('Set-Cookie', [
                `sessionId=${result.user.id}; Path=/; SameSite=Lax; Expires=${expires.toUTCString()}`,
                `sessionToken=${result.token}; Path=/; SameSite=Lax; Expires=${expires.toUTCString()}`
            ]);
            router.sendJson(res, result);
        } catch (error) {
            router.sendJson(res, {
                success: false,
                error: 'An error occurred during login'
            }, 500);
        }
    }

    async logout(req, res, router) {
        res.setHeader('Set-Cookie', [
            'sessionId=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
            'sessionToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
        ]);
        router.sendJson(res, { success: true, message: 'Logged out successfully' });
    }
}
