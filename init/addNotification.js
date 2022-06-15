const aws = require("aws-sdk");
const s3 = new aws.S3();
var md5 = require("md5");
module.exports.addNotification = async (userId, data) => {

    try {
        let key = 'notification' + userId;
        key = md5(key);
        let params = {
            Bucket: `apptmdt`,
            Key: `notification/${key.slice(0, 2)}/${key.slice(
                2,
                4
            )}/${key.slice(4, 6)}/${key.slice(6)}.json`,
            Body: JSON.stringify(data, null, 2),
        };
        await s3.putObject(params, function (err, data) {
            if (err) {
                console.log("Error MSG : ", err);
            } else {
                console.log("successFully upload data", data);
            }
        })
    } catch (e) {
        console.log(e);
    }


}