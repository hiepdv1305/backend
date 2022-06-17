'use strict';
const { response } = require("../init/res");
const bcrypt = require("bcryptjs");
const db = require('../init/db');
const { uuid } = require("uuidv4");
const { convertData } = require("../init/convertData")
const aws = require("aws-sdk");
const s3 = new aws.S3();
var md5 = require("md5");
const jwtHelper = require('../init/jwt')
const config = require("../Config/config")
const fields = {
    userId: { type: String, default: uuid() },
    username: { type: String },
    password: { type: String },
    address: { type: String },
    role: { type: String, default: 'user' },
    amout: { type: Number, default: 0 },
    fullname: { type: String, default: '' },
    phonenumber: { type: String, default: '' },
    email: { type: String, default: '' },
    gendle: { type: Number, default: 1 },
    createdAt: { type: Date, default: new Date().toISOString() },
    updatedAt: { type: Date, default: new Date().toISOString() }
};
const rechangeFields = {
    rechangeId: { type: String, default: uuid() },
    userId: { type: String },
    bankName: { type: String },
    amout: { type: Number },
    code: { type: String },
    bankAccount: { type: String },
    bankAccountNumber: { type: String }
}
const TableName = process.env.USER_TABLE;
const RechangeTable = process.env.RECHANGE_TABLE
module.exports.register = async (event, context, callback) => {
    context.callbackWaitsForEmptyEventLoop = false;
    let reqBody = JSON.parse(event.body);
    let salt = bcrypt.genSaltSync(10);
    reqBody.password = bcrypt.hashSync(reqBody.password, salt);
    let data = convertData(fields, reqBody);
    let params = {
        TableName: TableName,
        FilterExpression: '#username = :username',
        ExpressionAttributeNames: {
            '#username': 'username',
        },
        ExpressionAttributeValues: {
            ':username': data.username,
        },
    }
    return db.scan(params).promise().then((res) => {
        console.log(res)
        if (res.Count > 0) {
            console.log(1)
            return response("", "username already exists", 400);
        } else {
            return db.put({
                TableName: TableName,
                Item: data,
            }).promise()
                .then(() => {
                    return response("", "success", 200)
                })
        }
    }).catch((err) => {

        console.log(err)
        return res("", "server error", 500);
    })

};

module.exports.login = async (event, context, callback) => {
    let tokenList = {};
    context.callbackWaitsForEmptyEventLoop = false;
    const data = JSON.parse(event.body);
    const params = {
        TableName: TableName,
        FilterExpression: '#username = :username',
        ExpressionAttributeNames: {
            '#username': 'username',
        },
        ExpressionAttributeValues: {
            ':username': data.username,
        },
    }
    console.log(params);
    return db.scan(params).promise().then(async (res) => {
        console.log(res.Items[0])
        if (res && bcrypt.compareSync(data.password, res.Items[0].password)) {
            const accessToken = await jwtHelper.generateToken(res.Items[0], config.accessTokenSecret, config.accessTokenLife)
            const refreshToken = await jwtHelper.generateToken(res.Items[0], config.refreshTokenSecret, config.refreshTokenLife)
            tokenList[refreshToken] = { accessToken, refreshToken };
            // result.cookie('refreshToken', refreshToken, { secure: false, httpOnly: true, maxAge: config.refreshTokenCookieLife }); 
            return response(accessToken, "success", 200);
        } else {
            return response("", "user or password incorrect", 400)
        }
    }).catch(err => {
        return response("", "user or password incorrect", 400)
    })
};

module.exports.getNotification = async (event, context, callback) => {
    let user = context.prev;
    console.log(user)
    let key = 'notification' + user.userId;
    key = md5(key);
    let params = {
        Bucket: `apptmdt`,
        Key: `notification/${key.slice(0, 2)}/${key.slice(
            2,
            4
        )}/${key.slice(4, 6)}/${key.slice(6)}.json`,
    };
    return s3.getObject(params).promise().then(res => {
        console.log(res.Body.toString("utf-8"));
        return response(res.Body.toString("utf-8"), "success", 200);
    });

};

module.exports.update = async (event, context, callback) => {
    let user = context.prev;
    const id = event.pathParameters.id;
    return db.scan({
        TableName: TableName,
        FilterExpression: '#userId = :userId',
        ExpressionAttributeNames: {
            '#userId': 'userId',
        },
        ExpressionAttributeValues: {
            ':userId': user.userId,
        },
    }).promise()
        .then(res => {
            if (res.Count == 0) return response("", "user not exist")
            const item = JSON.parse(event.body);
            let updateExpression = 'set';
            let ExpressionAttributeNames = {};
            let ExpressionAttributeValues = {};
            for (const property in item) {
                updateExpression += ` #${property} = :${property} ,`;
                ExpressionAttributeNames['#' + property] = property;
                ExpressionAttributeValues[':' + property] = item[property];
            }
            updateExpression = updateExpression.slice(0, -1);
            const params = {
                TableName: TableName,
                Key: {
                    userId: user.userId,
                },
                UpdateExpression: updateExpression,
                ExpressionAttributeNames: ExpressionAttributeNames,
                ExpressionAttributeValues: ExpressionAttributeValues
            };
            return db.update(params).promise()
                .then((res) => {
                    return response(res, "success", 200)
                })
        })
        .catch(err => {
            return response("", err, 500)
        })

};

module.exports.rechange = async (event, context, callback) => {

    let user = context.prev;

    let data = JSON.parse(event.body);
    console.log(data)
    data = convertData(rechangeFields, data)
    return db.put({
        TableName: RechangeTable,
        Item: {
            userId: user.userId,
            bankName: data.bankName,
            amout: data.amout,
            rechangeId: data.rechangeId,
            code: data.code,
            bankAccount: data.bankAccount,
            bankAccountNumber: data.bankAccountNumber
        },
    }).promise().then(res => {
        return db.scan({
            TableName: TableName,
            FilterExpression: '#userId = :userId',
            ExpressionAttributeNames: {
                '#userId': 'userId',
            },
            ExpressionAttributeValues: {
                ':userId': user.userId,
            },
        }).promise().then(res => {
            return db.update({
                TableName: TableName,
                Key: {
                    userId: user.userId,
                },
                UpdateExpression: 'set #amout = :amout',
                ExpressionAttributeNames: {
                    "#amout": "amout"
                },
                ExpressionAttributeValues: {
                    ":amout": res.Items[0].amout + data.amout,
                },
            }).promise().then(res => {
                return response("", "success", 200)
            }).catch(err => {
                return response(err, "rechange unsuccess", 500)
            })
        }).catch(err => {
            return response(err, "user invalid", 500)
        })

    }).catch(err => {
        return response(err, "rechange unsuccess", 500)
    })
};

module.exports.getInfomation = async (event, context, callback) => {
    let user = context.prev;
    return db.scan({
        TableName: TableName,
        FilterExpression: '#userId = :userId',
        ExpressionAttributeNames: {
            '#userId': 'userId',
        },
        ExpressionAttributeValues: {
            ':userId': user.userId,
        },
    }).promise().then(res => {
        return response(res.Items[0], "success", 200)
    }).catch(err => {
        return response(err, "can't get user Infomation")
    })
};