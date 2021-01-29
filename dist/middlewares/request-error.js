"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class RequestError {
    // this would give an error by default. To suppress it go to lib.es5.d.ts and on line 973 add a '?' after name and before ':'
    constructor(message, errorCode, err) {
        this.code = errorCode;
        this.message = message;
        // If err is passed, it will be logged on the console
        if (err) {
            console.log("\n");
            const currentDate = new Date();
            const datetime = currentDate.getDate() + "/"
                + (currentDate.getMonth() + 1) + "/"
                + currentDate.getFullYear() + " @ "
                + currentDate.getHours() + ":"
                + currentDate.getMinutes() + ":"
                + currentDate.getSeconds();
            console.log(`The following error occurred on ${datetime}:`);
            console.log(err);
            console.log("error->catch");
            console.log("\n");
        }
    }
}
exports.default = RequestError;
