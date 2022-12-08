import { MongoClient } from "mongodb";

// Create a variable called "db_client", which is the database client, and export it so it is available as a module
// The "new MongoClient(url)" create a new MongoClient object/class that represents a client – a piece of code or software – that communicates with the MongoDB server
export const client = new MongoClient("mongodb://localhost:27117");

// Create another variable that represents the weather database
export const db = client.db("weather");