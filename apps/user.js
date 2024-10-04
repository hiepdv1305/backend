'use strict';
const { response } = require("../init/res");
const bcrypt = require("bcryptjs");
const db = require('../init/db');
const crypto = require('crypto');
const { convertData } = require("../init/convertData")
const aws = require("aws-sdk");
const s3 = new aws.S3();
var md5 = require("md5");
const jwtHelper = require('../init/jwt')
const config = require("../Config/config")
const fields = {
    userId: { type: String, default: crypto.randomBytes(16).toString('hex') },
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
    rechangeId: { type: String, default: crypto.randomBytes(16).toString('hex') },
    userId: { type: String },
    bankName: { type: String },
    amout: { type: Number },
    status: { type: String, default: 'waiting' },
    code: { type: String },
    bankAccount: { type: String },
    bankAccountNumber: { type: String },
    createdAt: { type: Date, default: new Date().toISOString() },
    updatedAt: { type: Date, default: new Date().toISOString() }
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
    // console.log(user)
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
        // console.log(res.Body.toString("utf-8"));
        return response(JSON.parse(res.Body.toString("utf-8")), "success", 200);
    }).catch(err => {
        return response(err, "Bạn không có thông báo nào", 500)
    });

};

module.exports.update = async (event, context, callback) => {
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
    data.userId = user.userId
    data = convertData(rechangeFields, data)
    return db.put({
        TableName: RechangeTable,
        Item: data
    }).promise().then(res => {
        return response("", "create rechange success", 200)
    }).catch(err => {
        return response(err, "rechange unsuccess", 500)
    })
};

module.exports.getInfomation = async (event, context, callback) => {
    let user = context.prev;
    return db.get({
        TableName: TableName,
        Key: {
            userId: user.userId,
        },
    }).promise().then(res => {
        return response(res.Item, "success", 200)
    }).catch(err => {
        return response(err, "can't get user Infomation")
    })
};

module.exports.increaseAccount = async (event, context, callback) => {
    const item = JSON.parse(event.body);
    let user = context.prev;
    return db.get({
        TableName: TableName,
        Key: {
            userId: user.userId,
        },
    }).promise().then(res => {
        db.update({
            TableName: TableName,
            Key: {
                userId: user.userId,
            },
            UpdateExpression: 'set #amout = :amout',
            ExpressionAttributeNames: {
                "#amout": "amout"
            },
            ExpressionAttributeValues: {
                ":amout": res.Item.amout + item.money,
            },
        })
    }).catch(err => {
        return response(err, "can't get user Infomation")
    })
};

module.exports.changePassword = async (event, context, callback) => {
    const data = JSON.parse(event.body);
    let user = context.prev;
    return db.get({
        TableName: TableName,
        Key: {
            userId: user.userId,
        },
    }).promise().then(res => {
        if (bcrypt.compareSync(data.oldPassword, res.Item.password)) {
            let salt = bcrypt.genSaltSync(10);
            return db.update({
                TableName: TableName,
                Key: {
                    userId: user.userId,
                },
                UpdateExpression: 'set #password = :password',
                ExpressionAttributeNames: {
                    "#password": "password"
                },
                ExpressionAttributeValues: {
                    ":password": bcrypt.hashSync(data.newPassword, salt),
                },
            }).promise().then(res => {
                return response("", "Thay đổi mật khẩu thành công", 200);
            })
        } else {
            return response("", "Mật khẩu cũ không chính xác", 500)
        }
    }).catch(err => {
        console.log(err)
        return response(err, "can't get user Infomation", 500);

    })
};
module.exports.acceptRechange = async (event, context, callback) => {
    let user = context.prev;
    if (user.role != 'admin') return response("", "not permistion", 500);
    const rechangeId = event.pathParameters.id;
    return db.get({
        TableName: RechangeTable,
        Key: {
            rechangeId: rechangeId,
        },
    }).promise().then(res => {
        if (res.Item.status != 'waiting') return response("", "invalid", 500)
        let amout = res.Item.amout
        return db.get({
            TableName: TableName,
            Key: {
                userId: res.Item.userId,
            },
        }).promise().then(res => {
            return db.update({
                TableName: TableName,
                Key: {
                    userId: res.Item.userId,
                },
                UpdateExpression: 'set #amout = :amout',
                ExpressionAttributeNames: {
                    "#amout": "amout"
                },
                ExpressionAttributeValues: {
                    ":amout": res.Item.amout + amout,
                },
            }).promise().then(res => {
                return db.update({
                    TableName: RechangeTable,
                    Key: {
                        rechangeId: rechangeId,
                    },
                    UpdateExpression: 'set #status = :status',
                    ExpressionAttributeNames: {
                        "#status": "status"
                    },
                    ExpressionAttributeValues: {
                        ":status": 'success',
                    },
                }).promise().then(res => {
                    return response("", "success", 200)
                }).catch(err => {
                    return response(err, "can't update rechange status")
                })
            }).catch(err => {
                return response(err, "rechange unsuccess", 500)
            })
        }).catch(err => {
            return response(err, "can't get user", 500)
        })


    }).catch(err => {
        return response(err, "rechange unsuccess", 500)
    })
};
module.exports.getAllRechange = async (event, context, callback) => {
    let user = context.prev;
    if (user.role != 'admin') return response("", "not permistion", 500);
    const params = {
        TableName: RechangeTable,
        FilterExpression: '#status = :status',
        ExpressionAttributeNames: {
            '#status': 'status',
        },
        ExpressionAttributeValues: {
            ':status': "waiting",
        },
    }
    return db.scan(params)
        .promise()
        .then((res) => {
            return response(res.Items, "success", 200)
        })
        .catch((err) => {
            return response("", err, 500)
        })
};
module.exports.denniRechange = async (event, context, callback) => {
    let user = context.prev;
    if (user.role != 'admin') return response("", "not permistion", 500);
    const rechangeId = event.pathParameters.id;

    return db.update({
        TableName: RechangeTable,
        Key: {
            rechangeId: rechangeId,
        },
        UpdateExpression: 'set #status = :status',
        ExpressionAttributeNames: {
            "#status": "status"
        },
        ExpressionAttributeValues: {
            ":status": 'denni',
        },
    }).promise().then(res => {
        return response("", "success", 200)
    }).catch(err => {
        return response(err, "can't update rechange status")
    })

};
module.exports.withdrawal = async (event, context, callback) => {

    let user = context.prev;

    let data = JSON.parse(event.body);
    data.userId = user.userId
    data = convertData(rechangeFields, data)
    return db.put({
        TableName: RechangeTable,
        Item: data
    }).promise().then(res => {
        return response("", "create rechange success", 200)
    }).catch(err => {
        return response(err, "rechange unsuccess", 500)
    })
};