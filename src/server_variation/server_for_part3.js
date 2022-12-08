import express from "express";
import { db } from "../database.js";
import cors from "cors";
import auth from "../auth.js";
import { ObjectId } from "bson";

// HDG 1 Create an express app and define listening port for backend
// define an object called app that represents the express application
const app = express();
const port = 8080;

// HDG 2 Enable the JSON parsing middleware
app.use(express.json());

// HDG 3 Enable the CORS middleware
const corsOptions = {
    // NB Refer to the default configuration options here: https://github.com/expressjs/cors#configuration-options OR the npm page for the latest specs
    // The default configuration's "methods" options already covered all HTTP methods to be used in the AT2, i.e., "GET,HEAD,PUT,PATCH,POST,DELETE"
    origin: true
}

app.use(cors(corsOptions));

// HDG 4 Define endpoints/routes here
// Testing route handler
// app.get("/get_reading", (req, res) => {
//     db.collection("readings").findOne()
//         .then((reading) => {
//             res.status(200).json(reading);
//         });
// });
// Pointers to the collections in the database
const access = db.collection("access");
const readings = db.collection("readings");

// [x] REQ 2A – Request a new authentication key (single)
// Since this is for authentication, it is more of a API key middleware than a route handler
// POST /request_api_key
// Body (JSON): NIL
app.options("/request_api_key", cors())
app.post("/request_api_key", (req, res) => {
    const default_role = "client";
    // NB MongoDB stores times in UTC by default, and converts any local time representations into this form.
    const date_now = new Date()

    access.insertOne({
        access_created_date: date_now,
        role: default_role,
    })
        .then((insert_result) => {
            res.status(200).json({
                api_key: insert_result.insertedId.toString(),
                access_created_date: date_now,
                role: default_role,
            })
        })
        .catch((error) => {
            res.status(500).json({
                code: 500,
                message: "Failed to create an API key. " + error
            })
        })
})

// [x] REQ 2B – Request multiple new authentication keys (multiple)
// Since this is for authentication, it is more of a API key middleware than a route handler
// POST /request_api_key
// Body (JSON): NIL
app.options("/request_api_keys", cors())
app.post("/request_api_keys", (req, res) => {
    const default_role = "client";
    // NB MongoDB stores times in UTC by default, and converts any local time representations into this form.
    const date_now = new Date()

    access.insertMany([
        {
            access_created_date: date_now,
            role: default_role,
        },
        {
            access_created_date: date_now,
            role: default_role,
        },
        {
            access_created_date: date_now,
            role: default_role,
        }
    ])
        .then((insert_result) => {
            res.status(200).json({
                message: "API keys created successfully",
                message2: insert_result
            })
        })
        .catch((error) => {
            res.status(500).json({
                code: 500,
                message: "Failed to create API keys. " + error
            })
        })
})

// [x] REQ 1 – Insert a new weather station (single) => Insert a weather report document (single) (and implicitly a weather station)
// POST /add_reading
// Body (JSON): An object with following properties:
//     api_key, Time, Device ID, Device Name, Latitude, Longitude, Temperature (C),
//     Atmospheric Pressure (kPa), Lightning Average Distance (km),
//     Lightning Strike Count, Maximum Wind Speed (m/s), Precipitation (mm/h),
//     Solar Radiation (W/m2), Vapor Pressure (kPa), Humidity (%),
//     Wind Direction (deg), Wind Speed (m/s)
//
// Auth: API Key required; Allowed role: "station", "admin"
app.options("/add_reading", cors())
app.post("/add_reading",
    auth(["station", "admin"]),
    (req, res) => {
        // Object destructuring to assign each property in "req.body" to an alias with a default value
        const {
            Time: time = new Date(),
            "Device ID": device_id = undefined,
            "Device Name": device_name = undefined,
            Latitude: latitude = undefined,
            Longitude: longitude = undefined,
            "Temperature (C)": temperature = undefined,
            "Atmospheric Pressure (kPa)": atmos_pressure = undefined,
            "Lightning Average Distance (km)": lightning_avg_dist = undefined,
            "Lightning Strike Count": lightning_strike_count = undefined,
            "Maximum Wind Speed (m/s)": max_wind_speed = undefined,
            "Precipitation (mm/h)": precipitation = undefined,
            "Solar Radiation (W/m2)": solar_radiation = undefined,
            "Vapor Pressure (kPa)": vapor_pressure = undefined,
            "Humidity (%)": humidity = undefined,
            "Wind Direction (deg)": wind_direction = undefined,
            "Wind Speed (m/s)": wind_speed = undefined,
        } = req.body;

        // Construct an object to be the document parameter, with validation during the process
        const reading_document = {};
        reading_document["Time"] = time;
        if (device_id) reading_document["Device ID"] = device_id;
        if (device_name) reading_document["Device Name"] = device_name;
        if (latitude) reading_document["Latitude"] = latitude;
        if (longitude) reading_document["Longitude"] = longitude;
        if (temperature) reading_document["Temperature (C)"] = temperature;
        if (atmos_pressure) reading_document["Atmospheric Pressure (kPa)"] = atmos_pressure;
        if (lightning_avg_dist) reading_document["Lightning Average Distance (km)"] = lightning_avg_dist;
        if (lightning_strike_count) reading_document["Lightning Strike Count"] = lightning_strike_count;
        if (max_wind_speed) reading_document["Maximum Wind Speed (m/s)"] = max_wind_speed;
        if (precipitation) reading_document["Precipitation (mm/h)"] = precipitation;
        if (solar_radiation) reading_document["Solar Radiation (W/m2)"] = solar_radiation;
        if (vapor_pressure) reading_document["Vapor Pressure (kPa)"] = vapor_pressure;
        if (humidity) reading_document["Humidity (%)"] = humidity;
        if (wind_direction) reading_document["Wind Direction (deg)"] = wind_direction;
        if (wind_speed) reading_document["Wind Speed (m/s)"] = wind_speed;

        // Insert one query with pre-constructed document parameter and error handling
        readings.insertOne(reading_document)
            .then((inserted_result) => {
                // TODO REQ 1 Improve the response messages
                res.status(200).json({
                    message: "Reading record successfully added.",
                    message2: inserted_result
                });
            })
            .catch((error) => {
                res.status(500).json({
                    code: 500,
                    message: "Failed to add reading record. " + error
                });
            });
    }
);

// [x] REQ 3 – Insert new fields to record the temperature information in Fahrenheit (6 fields) (multiple) => Update a list of weather documents to include Fahrenheit readings
// PATCH /fahrenheit_conversion
// Body (JSON): An object with following properties:
//     {
//         "api_key": "63056de53134ad3674bb9b3d",
//         "reading_ids": [
//             "63298d51f1ec27260f7b6e11", 
//             "63298d72f1ec27260f7b6e12", 
//             "63298d76f1ec27260f7b6e13", 
//             "63298d77f1ec27260f7b6e14", 
//             "63298d78f1ec27260f7b6e15", 
//             "63298d79f1ec27260f7b6e16"
//         ]
//     }
//
// Auth: API Key required; Allowed role: "station", "admin"
//
// With preflight requests enabled (options request below) 
app.options("/fahrenheit_conversion", cors())
app.patch("/fahrenheit_conversion",
    auth(["station", "admin"]),
    (req, res) => {
        // Validate and convert the array in "req.body.reading_ids" to an array of ObjectId to be used in the filter parameter
        const reading_ids = req.body.reading_ids
            .filter((reading_id) => ObjectId.isValid(reading_id))
            .map((reading_id) => ObjectId(reading_id));

        // Update many query with pipeline update parameter and error handling
        readings.updateMany(
            { _id: { $in: reading_ids } },
            [
                {
                    $set: {
                        "Temperature (F)": {
                            $add: [
                                { $multiply: ["$Temperature (C)", 1.8] }, 32
                            ]
                        }
                    }
                }
            ]
        )
            .then((updated_resultss) => {
                res.status(200).json({
                    message: "Temperature (F) field(s) successfully added.",
                    message2: updated_resultss
                });
            })
            .catch((error) => {
                res.status(500).json({
                    code: 500,
                    message: "Failed to add Temperature (F) field(s). " + error
                });
            })
    }
);

// [x] REQ 4 – Find the maximum precipitation recorded in the last 5 years (single)
// GET /max_precipitation_by_date_range
// Body (JSON): An object with 1 property:
//     {
//         "api_key": "63056de53134ad3674bb9b3d"
//     }
//
// Auth: API Key required; Allowed role: "client", "station", "admin"
app.options("/max_precipitation_by_date_range", cors())
app.get("/max_precipitation_by_date_range",
    auth(["client", "station", "admin"]),
    (req, res) => {
        // Find query and error handling, also can fulfill REQ 7
        readings.find(
            {
                '$expr': {
                    '$lte': [
                        { '$year': '$$NOW' },
                        { '$add': [{ '$year': '$Time' }, 5] }
                    ]
                }
            }
        )
            .sort({ "Precipitation (mm/h)": -1 })
            .limit(1)
            .project({ "_id": 0, "Precipitation (mm/h)": 1 })
            .toArray()
            .then((found_result) => {
                res.status(200).json({
                    message: `Maximum precipitation record successfully retrieved, which is ${found_result[0]["Precipitation (mm/h)"]} mm/h.`,
                });
            })
            .catch((error) => {
                res.status(500).json({
                    code: 500,
                    message: "Failed to retrieve maximum precipitation record. " + error
                });
            });
    }
)

// [x] REQ 5 – Find the temperature, atmospheric pressure, radiation and precipitation recorded by a specific station at a given date and time (hour) (multiple)
// GET /weather_metrics_at_date_hour
// Body (JSON): An object with following properties:
//     {
//         "api_key": "63056de53134ad3674bb9b3d",
//         "Specified Year": 2022,
//         "Specified Month": 9,
//         "Specified Day": 20,
//         "Specified Hour (24-hour)": 9
//     }
//
// Auth: API Key required; Allowed role: "client", "station", "admin"
app.options("/weather_metrics_at_date_hour", cors())
app.get("/weather_metrics_at_date_hour",
    auth(["client", "station", "admin"]),
    (req, res) => {
        // Object destructuring of "req.body" to be used in the query parameter
        const {
            "Specified Year": year_input = undefined,
            "Specified Month": month_input = undefined,
            "Specified Day": dayOfMonth_input = undefined,
            "Specified Hour (24-hour)": hour_input = undefined
        } = req.body;

        // Aggregation Pipeline $match $project and error handling
        readings.aggregate([
            {
                '$match': {
                    '$and': [
                        { '$expr': { '$eq': [year_input, { '$year': '$Time' }] } },
                        { '$expr': { '$eq': [month_input, { '$month': '$Time' }] } },
                        { '$expr': { '$eq': [dayOfMonth_input, { '$dayOfMonth': '$Time' }] } },
                        { '$expr': { '$eq': [hour_input, { '$hour': '$Time' }] } }
                    ]
                }
            }, {
                '$project': {
                    '_id': 0,
                    'Temperature (C)': 1,
                    'Atmospheric Pressure (kPa)': 1,
                    'Solar Radiation (W/m2)': 1,
                    'Precipitation (mm/h)': 1
                }
            }
        ]).toArray()
            .then((found_results) => {
                res.status(200).json({
                    message: "Weather metrics successfully retrieved.",
                    message2: found_results
                });
            })
            .catch((error) => {
                res.status(500).json({
                    code: 500,
                    message: "Failed to retrieve weather metrics. " + error
                });
            });
    }
);

// [x] REQ 6 – Use a batch operation to retrieve data from two or more documents (it depends on your schema) => Use batch object to retrieve multiple objects in one operation
// It is confirmed that the weather metrics endpoint built for REQ 5 can be used to fulfill REQ 6

// [x] REQ 7 – Create a query that includes an index key => Make sure one of the queries has the filter parameter/query parameter/$match stage that includes an index
// It is confirmed that "a field within the a query parameter of a find() method" can be used as the index to demonstrate this requirement, e.g., in the precipitation endpoint built for REQ 4, "Time" field as an index key is used for the query parameter

// [x] REQ 8 – Delete a user (single) => Delete an API key
// DELETE /delete_api_key
// Body (JSON): A JSON object with 1 property: 
//     {
//         "api_key": "..."
//     }
//
// Auth: API Key required; Allowed role: "admin", "station", "admin"
//
// With preflight requests enabled (options request below)
app.options("/delete_api_key", cors());
app.delete("/delete_api_key",
    // auth(["client", "station", "admin"]),
    (req, res) => {
        // Declare a variable to be used in the filter parameter
        // NB API key already validated in auth()
        const api_key_as_objectid = ObjectId(req.body.api_key);

        // Find one, delete one query and error handling
        access.findOne({ _id: api_key_as_objectid })
            .then((found_result) => {
                access.deleteOne({ _id: api_key_as_objectid })
                    .then((deleted_result) => {
                        res.status(200).json({
                            message: "API key successfully deleted.",
                            message2: deleted_result
                        })
                    })
                    .catch((error) => {
                        res.status(501).json({
                            code: 501,
                            message: "Failed to delete the API key. " + error
                        })
                    })
            })
            .catch((error) => {
                res.status(404).json({
                    code: 404,
                    message: "API key submitted is not found. " + error
                })
            })
    }
);

// [x] REQ 9 – Delete multiple users (multiple) => Delete multiple API keys
// DELETE /delete_api_keys
// Body (JSON): An object with following properties:
//     {
//         "api_key": "63056de53134ad3674bb9b3d",
//         "api_keys_to_delete": [
//             "...", "...", "..."
//         ]
//     }
//
// Auth: API Key required; Allowed role: "admin"
//
// With preflight requests enabled (options request below)
app.options("/delete_api_keys", cors());
app.delete("/delete_api_keys",
    auth(["admin"]),
    (req, res) => {
        // Declare a variable to be used in the filter parameter, with validation during the process
        const valid_api_keys_to_delete = req.body.api_keys_to_delete
            .filter((key) => ObjectId.isValid(key))
            .map((key) => ObjectId(key));

        // Find query and error handling
        access.find({ _id: { $in: valid_api_keys_to_delete } }).toArray()
            .then((found_results) => {
                if (found_results.length == req.body.api_keys_to_delete.length) {
                    // Delete many query and error handling
                    access.deleteMany({ _id: { $in: valid_api_keys_to_delete } })
                        .then((deleted_results) => {
                            res.status(200).json({
                                message: "API key(s) successfully deleted.",
                                message2: deleted_results
                            })
                        })
                        .catch((error) => {
                            res.status(501).json({
                                code: 501,
                                message: "Failed to delete API key(s). " + error
                            })
                        })
                } else {
                    res.status(404).json({
                        code: 404,
                        message: "API key(s) to be deleted are not found. " + error
                    })
                }
            })
            .catch((error) => {
                res.status(500).json({
                    code: 500,
                    message: "Database error. " + error
                })
            })
    }
);

// [x] REQ 10 – Update a specific weather station longitude and latitude (single)
// PATCH /update_location
// Body (JSON): A JSON object with following properties:
//     {
//         "api_key": "63056de53134ad3674bb9b3d",
//         "reading_id": "63298d79f1ec27260f7b6e16",
//         "Latitude": -32.96599,
//         "Longitude": 151.69513
//     }
//
// Auth: API Key required; Allowed role: "station", "admin"
//
// With preflight requests enabled (options request below)
app.options("/update_location", cors());
app.patch("/update_location",
    auth(["station", "admin"]),
    (req, res) => {
        // Object destructuring of req.body
        const {
            reading_id = undefined,
            Latitude: latitude = undefined,
            Longitude: longitude = undefined
        } = req.body;

        // Validate reading_id in "req.body" by using a statement
        if (ObjectId.isValid(reading_id)) {
            // Find on query and error handling
            readings.findOne({ _id: ObjectId(reading_id) })
                .then((found_result) => {
                    if (found_result._id == req.body.reading_id) {
                        // Construct an object to be used in the the update parameter, with validation during the process 
                        const coordinate_update = {}
                        if (latitude) coordinate_update["Latitude"] = latitude;
                        if (longitude) coordinate_update["Longitude"] = longitude;
                        // Update one query with pre-constructed update parameter and error handling
                        readings.updateOne(
                            { _id: ObjectId(reading_id) },
                            { $set: coordinate_update }
                        )
                            .then((updated_result) => {
                                res.status(200).json({
                                    message: "Coordinate fields successfully updated.",
                                    message2: updated_result
                                });
                            })
                            .catch((error) => {
                                res.status(500).json({
                                    code: 500,
                                    message: "Failed to update coordinate fields. " + error
                                });
                            })
                    } else {
                        res.status(404).json({
                            code: 404,
                            message: "Reading record to be updated is not found. " + error
                        })
                    }
                })
                .catch((error) => {
                    res.status(500).json({
                        code: 500,
                        message: "Database error. " + error
                    })
                })
        } else {
            res.status(400).json({
                code: 400,
                message: "Reading ID submitted is invalid. " + error
            })
        }
    }
);

// [x] REQ 11A – Update access level for at least two users in the same query (multiple) => Update the roles of API keys to "client"
// PATCH /set_api_keys_to_client
// Body (JSON): An object with following properties:
//     {
//         "api_key": "63056de53134ad3674bb9b3d",
//         "set_role":"client",
//         "api_keys_to_update": [
//            "632a8b8d16e6611e4e222b6f", 
//            "632a8b8f16e6611e4e222b70", 
//            "632a8d9a16e6611e4e222b71"
//         ]
//     }
//
// Auth: API Key required; Allowed role: "admin"
//
// With preflight requests enabled (options request below)
app.options("/set_api_keys_to_client", cors());
app.patch("/set_api_keys_to_client",
    auth(["admin"]),
    (req, res) => {
        // Validate keys to be updated within a loop: for those to be set as "client"
        let valid_api_keys_to_update = []
        for (let key of req.body.api_keys_to_update) {
            if (!ObjectId.isValid(key)) {
                res.status(400).json({
                    code: 400,
                    message: "API key(s) to be updated are invalid. " + error
                })
                return;
            }
            let key_as_objectid = ObjectId(key);
            valid_api_keys_to_update.push(key_as_objectid);
        }

        // Find query and error handling: for those to be set as "client"
        access.find({ _id: { $in: valid_api_keys_to_update } }).toArray()
            .then((found_results) => {
                // Evaluate the length of the found_results array and error handling
                if (found_results.length == req.body.api_keys_to_update.length) {
                    // Update many with pipeline update parameter and error handling
                    access.updateMany(
                        { _id: { $in: valid_api_keys_to_update } },
                        [
                            {
                                $set: {
                                    "role": req.body.set_role
                                    // ET ABOVE: "role": "client"
                                }
                            }
                        ]
                    )
                        .then((updated_results) => {
                            res.status(200).json({
                                message: "Role field(s) successfully updated.",
                                message2: updated_results
                            });
                        })
                        .catch((error) => {
                            res.status(500).json({
                                code: 500,
                                message: "Failed to update role field(s). " + error
                            });
                        })

                } else {
                    res.status(404).json({
                        code: 404,
                        message: "API key(s) to be updated not found. " + error
                    })
                }
            })
            .catch((error) => {
                res.status(500).json({
                    code: 500,
                    message: "Database error. " + error
                })
            })
    }
);

// [x] REQ 11B – Update access level for at least two users in the same query (multiple) => Update the roles of API keys to "station"
// PATCH /set_api_keys_to_station
// Body (JSON): An object with following properties:
//     {
//         "api_key": "63056de53134ad3674bb9b3d",
//         "set_role":"station",
//         "api_keys_to_update": [
//            "632a8b8d16e6611e4e222b6f", 
//            "632a8b8f16e6611e4e222b70", 
//            "632a8d9a16e6611e4e222b71""
//         ]
//     }
//
// Auth: API Key required; Allowed role: "admin"
//
// With preflight requests enabled (options request below)
app.options("/set_api_keys_to_station", cors());
app.patch("/set_api_keys_to_station",
    auth(["admin"]),
    (req, res) => {
        // Validate keys to be updated within a loop: for those to be set as "station"
        let valid_api_keys_to_update = []
        for (let key of req.body.api_keys_to_update) {
            if (!ObjectId.isValid(key)) {
                res.status(400).json({
                    code: 400,
                    message: "API key(s) to be updated are invalid. " + error
                })
                return;
            }
            let key_as_objectid = ObjectId(key);
            valid_api_keys_to_update.push(key_as_objectid);
        }

        // Find query and error handling: for those to be set as "station"
        access.find({ _id: { $in: valid_api_keys_to_update } }).toArray()
            .then((found_results) => {
                // Evaluate the length of the found_results array and error handling
                if (found_results.length == req.body.api_keys_to_update.length) {
                    // Update many with pipeline update parameter and error handling
                    access.updateMany(
                        { _id: { $in: valid_api_keys_to_update } },
                        [
                            {
                                $set: {
                                    "role": req.body.set_role
                                    // ET ABOVE: "role": "station"
                                }
                            }
                        ]
                    )
                        .then((updated_results) => {
                            res.status(200).json({
                                message: "Role field(s) successfully updated.",
                                message2: updated_results
                            });
                        })
                        .catch((error) => {
                            res.status(500).json({
                                code: 500,
                                message: "Failed to update role field(s). " + error
                            });
                        })

                } else {
                    res.status(404).json({
                        code: 404,
                        message: "API key(s) to be updated not found. " + error
                    })
                }
            })
            .catch((error) => {
                res.status(500).json({
                    code: 500,
                    message: "Database error. " + error
                })
            })
    }
);

// [x] REQ 11C – Update access level for at least two users in the same query (multiple) => Update the roles of API keys to "admin"
// PATCH /set_api_keys_to_admin
// Body (JSON): An object with following properties:
//     {
//         "api_key": "63056de53134ad3674bb9b3d",
//         "set_role":"admin",
//         "api_keys_to_update": [
//            "632a8b8d16e6611e4e222b6f", 
//            "632a8b8f16e6611e4e222b70", 
//            "632a8d9a16e6611e4e222b71"
//         ]
//     }
//
// Auth: API Key required; Allowed role: "admin"
//
// With preflight requests enabled (options request below)
app.options("/set_api_keys_to_admin", cors());
app.patch("/set_api_keys_to_admin",
    auth(["admin"]),
    (req, res) => {
        // Validate keys to be updated within a loop: for those to be set as "admin"
        let valid_api_keys_to_update = []
        for (let key of req.body.api_keys_to_update) {
            if (!ObjectId.isValid(key)) {
                res.status(400).json({
                    code: 400,
                    message: "API key(s) to be updated are invalid. " + error
                })
                return;
            }
            let key_as_objectid = ObjectId(key);
            valid_api_keys_to_update.push(key_as_objectid);
        }

        // Find query and error handling: for those to be set as "admin"
        access.find({ _id: { $in: valid_api_keys_to_update } }).toArray()
            .then((found_results) => {
                // Evaluate the length of the found_results array and error handling
                if (found_results.length == req.body.api_keys_to_update.length) {
                    // Update many with pipeline update parameter and error handling
                    access.updateMany(
                        { _id: { $in: valid_api_keys_to_update } },
                        [
                            {
                                $set: {
                                    "role": req.body.set_role
                                    // ET ABOVE: "role": "admin"
                                }
                            }
                        ]
                    )
                        .then((updated_results) => {
                            res.status(200).json({
                                message: "Role field(s) successfully updated.",
                                message2: updated_results
                            });
                        })
                        .catch((error) => {
                            res.status(500).json({
                                code: 500,
                                message: "Failed to update role field(s). " + error
                            });
                        })

                } else {
                    res.status(404).json({
                        code: 404,
                        message: "API key(s) to be updated not found. " + error
                    })
                }
            })
            .catch((error) => {
                res.status(500).json({
                    code: 500,
                    message: "Database error. " + error
                })
            })
    }
);

// HDG 5 Listen for incoming requests: specify the port that is defined higher up, and give a callback function when the port is ready
// NB All endpoints need to be defined before the listening
app.listen(port, () => {
    console.log(`Express server started on http://localhost:${port}`);
});