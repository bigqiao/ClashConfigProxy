import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { errorHandler } from './middleware/errorHandler';
import { schemeRoutes } from './routes/schemes';
import { configRoutes } from './routes/configs';
import { aggregateRoutes } from './routes/aggregate';
import { logger } from './utils/logger';

const app = express();
const PORT = Number(process.env.PORT) || 8888;
const HOST = '0.0.0.0';

app.use(helmet({
    contentSecurityPolicy: false
}));
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

app.use('/api/schemes', schemeRoutes);
app.use('/api', configRoutes);
app.use('/api', aggregateRoutes);

if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../../frontend/dist')));

    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
    });
}

app.use(errorHandler);

app.listen(PORT, HOST, () => {
    logger.info(`Server running on ${HOST}:${PORT}`);
    console.log(`🚀 Server running on http://${HOST}:${PORT}`);
});
