import dotenv from "dotenv";
import express, { Express, Request, Response } from 'express';
import cookieParser from "cookie-parser";
import database from "./client/database";

const app: Express = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());


const port = 5001;

app.get('/', (req: Request, res: Response) => {
    res.send('Typescript + Node.js + Express Server');
});

const server = app.listen(process.env.MVCC_PORT, () => {
    console.log(`run port : ${port}`);
});

server.on("close", async () => {
    await database.$disconnect();
});