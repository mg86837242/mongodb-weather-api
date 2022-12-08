import express from "express";
import { db } from "./database.js";

// HDG 1 Create an express app and define listening port for backend
// define an object called app that represents the express application
const app = express();
const port = 8080;

// HDG 2 Enable the JSON parsing middleware
app.use(express.json());

// HDG 3 Enable the CORS middleware here

// HDG 4 Define endpoints/routes here
// Pointers to the collections in the database
const access = db.collection("access");
const readings = db.collection("readings");

// Testing route handler
app.get("/get_reading", (req, res) => {
    readings.findOne()
        .then((reading) => {
            res.status(200).json(reading);
        });
});

// HDG 5 Listen for incoming requests: specify the port that is defined higher up, and give a callback function when the port is ready
// NB All endpoints need to be defined before the listening
app.listen(port, () => {
    console.log(`Express server started on http://localhost:${port}`);
});