import express from 'express';
import { SessionController } from '../controllers/SessionController.js';

const router = express.Router();
const sessionController = new SessionController();

router.use((req, res, next) => sessionController.requireAuth(req, res, next));

router.get('/:id', (req, res) => sessionController.show(req, res));

router.post('/book', (req, res) => sessionController.book(req, res));
router.post('/accept', (req, res) => sessionController.accept(req, res));
router.post('/complete', (req, res) => sessionController.complete(req, res));
router.post('/cancel', (req, res) => sessionController.cancel(req, res));

export default router;
