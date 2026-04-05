const express = require('express');
const cors = require('cors');
require('dotenv').config();

const systemsRouter = require('./routes/systems');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/systems', systemsRouter);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(process.env.PORT, () => {
  console.log(`API running on port ${process.env.PORT}`);
});
