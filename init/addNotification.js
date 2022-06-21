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
        };
        s3.getObject(params).promise().then(res => {
            let source = [];
            if (JSON.parse(res.Body.toString("utf-8")).length > 1) {
                source = JSON.parse(res.Body.toString("utf-8"))
                console.log(source)
                source.push(data)
                let params = {
                    Bucket: `apptmdt`,
                    Key: `notification/${key.slice(0, 2)}/${key.slice(
                        2,
                        4
                    )}/${key.slice(4, 6)}/${key.slice(6)}.json`,
                    Body: JSON.stringify(source, null, 2),
                };
                s3.putObject(params, function (err, data) {
                    if (err) {
                        console.log("Error MSG : ", err);
                    } else {
                        console.log("successFully upload data", data);
                    }
                }).promise()
            } else {
                source.push(JSON.parse(res.Body.toString("utf-8")))
                source.push(data)
                let params = {
                    Bucket: `apptmdt`,
                    Key: `notification/${key.slice(0, 2)}/${key.slice(
                        2,
                        4
                    )}/${key.slice(4, 6)}/${key.slice(6)}.json`,
                    Body: JSON.stringify(source, null, 2),
                };
                s3.putObject(params, function (err, data) {
                    if (err) {
                        console.log("Error MSG : ", err);
                    } else {
                        console.log("successFully upload data", data);
                    }
                }).promise()
            }
        }).catch(err => {
            let params = {
                Bucket: `apptmdt`,
                Key: `notification/${key.slice(0, 2)}/${key.slice(
                    2,
                    4
                )}/${key.slice(4, 6)}/${key.slice(6)}.json`,
                Body: JSON.stringify(data, null, 2),
            };
            s3.putObject(params, function (err, data) {
                if (err) {
                    console.log("Error MSG : ", err);
                } else {
                    console.log("successFully upload data", data);
                }
            }).promise()
        })
    } catch (e) {
        console.log(e);
    }
}