/*
Test code: 
    const changeEvent = {
        operationType: "INSERT",
        fullDocument: {
          _id: BSON.ObjectId("6333b7e5bda2af4e1b3f707b"),
          "Device Name": "Hello World Device"
        }
    } //Add a changeEvent to test it with your Trigger
    exports(changeEvent);
*/

exports = function (changeEvent) {
    const fullDocument = changeEvent.fullDocument;

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

        const readings = context.services
            .get("weather-data")
            .db("weather")
            .collection("readings");

        readings
            .updateMany(
                { _id: fullDocument._id },
                { $set: { "Device ID": generatedDeviceID } }
            )
            .then((result) => {
                console.log(JSON.stringify(result));
            })
            .catch((error) => {
                console.log(error);
            });
    }
};