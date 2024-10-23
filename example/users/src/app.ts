// app.ts
import app from '../config/server';

const port = process.env.PORT || 3000;

const runApp = async () => {
    (await app).listen(port, () => {
      console.log(`Server is running on  http://localhost:${port}`);
    });
}

runApp()