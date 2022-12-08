import { ObjectId } from "bson"
import { db } from "./database.js"

// Define an API-key-based authentication middleware
// P.S. This function is a higher-order function cuz it returns a function
export default function auth(allowed_roles) {
    // P.S. The "next" function (1) comes from Express.js: http://expressjs.com/en/guide/writing-middleware.html, (2) is a function in the Express router which, when invoked, executes the middleware succeeding the current middleware, (3) is arbitrarily named "next" by convention
    return function (req, res, next) {
        const api_key = req.body.api_key

        if (ObjectId.isValid(api_key)) {
            const access = db.collection("access")
            access.findOne({ _id: ObjectId(api_key) })
                .then((access_document) => {
                    if (allowed_roles.includes(access_document.role)) {
                        next();
                    } else {
                        res.status(403).json({
                            code: 403,
                            message: "Forbidden - API key has insufficient privilege.",
                        })
                    }
                })
                .catch((error) => {
                    res.status(404).json({
                        code: 404,
                        message: "Not found - API key not found.",
                    })
                })
        } else {
            res.status(401).json({
                code: 401,
                message: "Unauthorised - API key is invalid or missing.",
            })
        }
    }
}
