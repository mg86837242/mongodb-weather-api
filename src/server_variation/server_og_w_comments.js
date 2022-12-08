import express from "express";
import { db } from "./database.js";
import cors from "cors";
import auth from "./auth.js";
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

// [x] TRG 1 – REQ 1 – Auto-generate a device ID
const addDeviceIdTrigger = (fullDocument) => {
    if (fullDocument["Device ID"] == null && fullDocument["Device Name"]) {
        const generatedDeviceID = fullDocument["Device Name"]
            .split(" ")
            .map(
                (part) =>
                    part.substring(0, Math.min(part.length, 2)) +
                    part.substring(part.length - 2, part.length)
            )
            .join("_")
            .toLowerCase();
        fullDocument["Device ID"] = generatedDeviceID;
    }
}

// [x] TRG 2 – REQ 1 – Auto-generate temperature information in Kevin
const addTempKevinTrigger = (fullDocument) => {
    if (fullDocument["Temperature (K)"] == null && fullDocument["Temperature (C)"]) {
        const generatedTempKevin = (fullDocument["Temperature (C)"] + 273.15).toFixed(2);
        fullDocument["Temperature (K)"] = generatedTempKevin;
    }
}

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
        // Object destructuring to assign each property in "req.body" to an alias with a default value:
        // • Each variable on the very left side are given an alias by using a colon
        // • Each variable on the very left side are given an default value by using an equals sign
        // • Double quotes are not needed for single-word variables
        const {
            // NB There is no need to include the "api_key" during the destructuring process, since it was already used by auth(), which occurs before this function
            // Refer to MongoDB Manual to check the behavior of "new Date()"
            // Alternatively, use "console.log" to check the behavior of "new Date()" in Compass shell
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
        // The reason for not using the constructor in the /add_reading endpoint => allows to omit different fields & easier for validation
        const reading_document = {};
        // P.S. Property accessors – bracket notation is used because there're spaces between names, e.g., "Device ID"
        // if (device_id != undefined) ...
        //     • "If statement", in which the condition is followed by 1 statement, can't be replaced by "ternary operator" here b/c the condition is followed by 2 expressions in the syntax of ternary
        //     • So it comes down to statement vs expression: 
        //     NB "A statement performs and action", while "an expression produces a value and can be written wherever a value is expected" quoted from: Axel Rauschmayer's article recommended in https://stackoverflow.com/questions/12703214/javascript-difference-between-a-statement-and-an-expression
        //     • E.G. Explanation for "Device ID": if device_id is NOT undefined, then insert the value of device_id into the document with the name "Device ID"
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

        // Invoke triggers
        addDeviceIdTrigger(reading_document);
        addTempKevinTrigger(reading_document);

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
        // TODO Catching 400 and 404 are intentionally left out for now but can be added later
        // Validate and convert the array in "req.body.reading_ids" to  an array of ObjectId to be used in the filter parameter
        // I.E. Get and validate the list of reading ids, which is an array, and a pipeline (or chain) is written
        const reading_ids = req.body.reading_ids
            // Filtering and Mapping within the pipeline
            //     • P.S. filter() method is a higher-order function, in the context of functional programming that is declarative, while the imperative programming is procedural. A predicate function as the parameter of the filter() method/function.
            //     • E.G. The following code will only output even numbers
            //     • [10, 5, 2, 8, 20, 4, 7].filter ((number) => number % 2 == 0)
            //     • In this case, the filter() method is filtering any id that is not valid.
            .filter((reading_id) => ObjectId.isValid(reading_id))
            //     • P.S. map() method is a high-order function, in the context of functional programming
            //     • E.G. The following code will convert ["1", "4", "6"] to [1, 4, 6]
            //     • ["1", "4", "6"].map(number => Number(number))
            //     • In this case, map() method breaks down reading_ids array, then enclose every single one of the array element with ObjectId() parenthesis.
            //     • P.P.S. The process in the mapping is parsing/deserialization
            .map((reading_id) => ObjectId(reading_id));
        // This an example of output from code above:
        // reading_ids = [
        //     new ObjectId("62e2a06d7976966260bb7e17"),
        //     new ObjectId("62e2a06d7976966260bb7e3e")
        // ]

        // ET ABOVE: Imperative/procedural way of doing what is coded above
        // let reading_ids = []
        // for (let reading_id in req.body) {
        //     if (!ObjectId.isValid(reading_id)) {
        //         continue;
        //     }
        //     let reading_id_as_objectid = ObjectId(reading_id);
        //     reading_ids.push(reading_id_as_object_id);
        // }

        // Update many query with pipeline update parameter and error handling
        readings.updateMany(
            { _id: { $in: reading_ids } },
            // NB Refer to the syntax of db.collection.updateMany() for why to use square bracket here – update with aggregation pipeline
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
        // Find the max value of "$Precipitation (mm/h)" within documents recorded in the last 5 years
        // ET Method 4.1 Aggregation Pipeline $match $group $project => preferred b/c it allows a customized field to be shown as the output
        // readings.aggregate([
        //     {
        //         '$match': {
        //             '$expr': {
        //                 '$lte': [
        //                     { '$year': '$$NOW' },
        //                     { '$add': [{ '$year': '$Time' }, 5] }
        //                 ]
        //             }
        //         }
        //     }, {
        //         '$group': {
        //             '_id': null,
        //             'Maximum Precipitation (mm/h)': {
        //                 '$max': '$Precipitation (mm/h)'
        //             }
        //         }
        //     }, {
        //         '$project': {
        //             '_id': 0
        //         }
        //     }
        // ]).toArray()
        //     .then((found_result) => {
        //         console.log(found_result.length);
        //         res.status(200).json({
        //             // How to produce a non-object type output in the /max_precipitation_by_date_range endpoint, referring to https://mongodb.github.io/node-mongodb-native/4.9/classes/FindCursor.html#project => b/c the toArray() method is used, so the found_result is an object in an array, so [0] is needed to get the object out of the array, then property accessors can be used
        //             message: `Maximum precipitation record successfully retrieved, which is ${found_result[0]["Maximum Precipitation (mm/h)"]} mm/h.`,
        //         });
        //     })
        //     .catch((error) => {
        //         res.status(500).json({
        //             code: 500,
        //             message: "Failed to retrieve maximum precipitation record. " + error
        //         });
        //     });

        // ET Method 4.2 Aggregation Pipeline $match $sort $limit $project
        // readings.aggregate([
        //     {
        //         '$match': {
        //             '$expr': {
        //                 '$lte': [
        //                     { '$year': '$$NOW' },
        //                     { '$add': [{ '$year': '$Time' }, 5] }
        //                 ]
        //             }
        //         }
        //     }, {
        //         '$sort': {
        //             'Precipitation (mm/h)': -1
        //         }
        //     }, {
        //         '$limit': 1
        //     }, {
        //         '$project': {
        //             '_id': 0,
        //             'Precipitation (mm/h)': 1
        //         }
        //     }
        // ]).toArray()
        //     .then((found_result) => {
        //         res.status(200).json({
        //             message: `Maximum precipitation record successfully retrieved, which is ${found_result[0]["Precipitation (mm/h)"]} mm/h.`,
        //         });
        //     })
        //     .catch((error) => {
        //         res.status(500).json({
        //             code: 500,
        //             message: "Failed to retrieve maximum precipitation record. " + error
        //         });
        //     });

        // ET Method 4.3 MQL find(query).sort().limit().project().toArray() => preferred b/c it can fulfill the REQ 7
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

        // XXX Method 4.4 MQL find(query, AP projection) + chaining then() & catch() => don't know how to write the AP projection
        // readings.find(
        //     // An expression resembles: "$$NOW" - "$Time" ≤ 5 years
        //     {
        //         $expr: {
        //             $lte: [
        //                 { $year: "$$NOW" },
        //                 { $add: [ { $year: "$Time" }, 5 ] }
        //             ]
        //         }
        //     },
        //     {
        //         // Don't know how to write an aggregation expression as the projection parameter to find the max value
        //     }
        // )
        //     .then((found_result) => {
        //         res.status(200).json({
        //             message: "Maximum precipitation record successfully retrieved."
        //         });
        //     })
        //     .catch((error) => {
        //         res.status(500).json({
        //             code: 500,
        //             message: "Failed to retrieve maximum precipitation record. " + error
        //         });
        //     });
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

        // ET Method 5.1 Aggregation Pipeline $match $project and error handling => preferred b/c I can test the AP $match stage in the MongoDB Compass
        readings.aggregate([
            {
                '$match': {
                    '$and': [
                        {
                            // NB $expr Allows the use of aggregation expressions within the query language.
                            '$expr': {
                                // NB $eq here is actually $eq(aggregation)
                                '$eq': [
                                    year_input, {
                                        '$year': '$Time'
                                    }
                                ]
                            }
                        }, {
                            '$expr': {
                                '$eq': [
                                    month_input, {
                                        '$month': '$Time'
                                    }
                                ]
                            }
                        }, {
                            '$expr': {
                                '$eq': [
                                    dayOfMonth_input, {
                                        '$dayOfMonth': '$Time'
                                    }
                                ]
                            }
                        }, {
                            '$expr': {
                                '$eq': [
                                    hour_input, {
                                        '$hour': '$Time'
                                    }
                                ]
                            }
                        }
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
                    // TODO REQ 5.1 Improve the response messages
                    message: "Weather metrics successfully retrieved.",
                    message2: found_results[0]
                });
            })
            .catch((error) => {
                res.status(500).json({
                    code: 500,
                    message: "Failed to retrieve weather metrics. " + error
                });
            });

        // ET Method 5.2 Find query and error handling
        // readings.find(
        //     {
        //         $and: [
        //             {
        //                 // NB $expr Allows the use of aggregation expressions within the query language.
        //                 $expr: {
        //                     // NB $eq here is actually $eq(aggregation)
        //                     $eq: [year_input, { $year: "$Time" }]
        //                 }
        //             },
        //             {
        //                 $expr: {
        //                     $eq: [month_input, { $month: "$Time" }]
        //                 },
        //             },
        //             {
        //                 $expr: {
        //                     $eq: [dayOfMonth_input, { $dayOfMonth: "$Time" }]
        //                 },
        //             },
        //             {
        //                 $expr: {
        //                     $eq: [hour_input, { $hour: "$Time" }]
        //                 }
        //             }
        //         ]
        //     }
        // )
        //     .project({
        //         "_id": 0,
        //         "Temperature (C)": 1,
        //         "Atmospheric Pressure (kPa)": 1,
        //         "Solar Radiation (W/m2)": 1,
        //         "Precipitation (mm/h)": 1
        //     })
        //     .toArray()
        //     .then((found_results) => {
        //         res.status(200).json({
        //             // TODO REQ 5.2 Improve the response messages
        //             message: "Weather metrics successfully retrieved.",
        //             message2: found_results[0]
        //         });
        //     })
        //     .catch((error) => {
        //         res.status(500).json({
        //             code: 500,
        //             message: "Failed to retrieve weather metrics. " + error
        //         });
        //     });
    }
);

// [x] REQ 6 – Use a batch operation to retrieve data from two or more documents (it depends on your schema) => Use batch object to retrieve multiple objects in one operation
// It is confirmed that the weather metrics endpoint built for REQ 5 can be used to fulfill REQ 6

// [x] REQ 7 – Create a query that includes an index key => Make sure one of the queries has the filter parameter/query parameter/$match stage that includes an index
// For the requirement "create a query that includes an index key", what does it mean by "filtering" in the "filtering on an index", in relation to "filter parameter/query parameter/$match stage" => It is confirmed that "a field within the a query parameter of a find() method" can be used as the index to demonstrate this requirement, e.g., in the precipitation endpoint built for REQ 4, "Time" field as an index key is used for the query parameter

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
                            // TODO REQ 8 Improve the response messages
                            message: "API key successfully deleted.",
                            message2: deleted_result
                        })
                    })
                    .catch((error) => {
                        res.status(501).json({
                            // The reason why 501 is used in the /delete_api_keys endpoint is b/c the error is definite in a delete operation, i.e., we're certain about the error, while the 500 error is for generalized errors that are not definite and can be more than one type of error
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
        // TODO Catching 400 is intentionally left out for now but can be added later
        const valid_api_keys_to_delete = req.body.api_keys_to_delete
            .filter((key) => ObjectId.isValid(key))
            .map((key) => ObjectId(key));

        // Find query and error handling
        access.find({ _id: { $in: valid_api_keys_to_delete } }).toArray()
            .then((found_results) => {
                // How to use the found_results as the basis for filter in the deleteMany() of the /delete_api_keys endpoint, given that the found_results is an array of objects OR can I just ignore the found_results? => Evaluate the length of the found_results array and error handling
                if (found_results.length == req.body.api_keys_to_delete.length) {
                    // Delete many query and error handling
                    access.deleteMany({ _id: { $in: valid_api_keys_to_delete } })
                        .then((deleted_results) => {
                            res.status(200).json({
                                // TODO REQ 9 Improve the response messages
                                message: "API key(s) successfully deleted.",
                                message2: deleted_results
                            })
                        })
                        .catch((error) => {
                            res.status(501).json({
                                // The reason why 501 is used in the /delete_api_keys endpoint is b/c the error is definite in a delete operation, i.e., we're certain about the error, while the 500 error is for generalized errors that are not definite and can be more than one type of error
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
            // NB There is no need to include the "api_key" during the destructuring process, since it was already used by auth(), which occurs before this function
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
                                    // TODO REQ 10 Improve the response messages
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
                // Return statement ends function execution and specifies an "undefined" value to be returned to the function caller
                // Alternatively, use continue statement
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
                                // TODO REQ 11A Improve the response messages
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
                // Return statement ends function execution and specifies an "undefined" value to be returned to the function caller
                // Alternatively, use continue statement
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
                                // TODO REQ 11B Improve the response messages
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
                // Return statement ends function execution and specifies an "undefined" value to be returned to the function caller
                // Alternatively, use continue statement
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
                                // TODO REQ 11B Improve the response messages
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