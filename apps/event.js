'use strict';
const { response } = require("../init/res");
const db = require('../init/db');
const { uuid } = require("uuidv4");
const { convertData } = require("../init/convertData")
const { addNotification } = require('../init/addNotification')
const fields = {
    eventId: { type: String, default: uuid() },
    productId: { type: String },
    eventName: { type: String },
    description: { type: String, default: '' },
    image: { type: String },
    status: { type: String, default: 'active' },
    price: { type: Number },
    currentPoint: { type: Number, default: 0 },
    totalPoint: { type: Number },
    winner: { type: String, default: null },
    createdAt: { type: Date, default: new Date().toISOString() },
    updatedAt: { type: Date, default: new Date().toISOString() }
};
// const axios = require("axios");
const TableName = process.env.EVENT_TABLE;
module.exports.create = async (event, context, callback) => {
    // let user = context.jwtDecoded;
    let user = context.prev;
    // console.log(user.role)
    if (user.role != "admin") {
        return response("", "no permision", 500)
    } else {
        let reqBody = JSON.parse(event.body);
        let data = convertData(fields, reqBody);
        console.log(data)
        return db.put(
            {
                TableName: TableName,
                Item: data,
            }
        ).promise()
            .then((res) => {
                console.log(res)
                return response(res, "succces", 200);
            })
            .catch((err) => {
                return response("", "server error", 400)
            })

    }

};

module.exports.delete = async (event, context, callback) => {
    // let user = context.jwtDecoded;
    let user = context.prev;
    if (user.role != "admin") {
        return response("", "no permision", 500)
    } else {
        const id = event.pathParameters.id
        const params = {
            TableName: TableName,
            Key: {
                eventId: id,
            },
            UpdateExpression: 'set #status = :status',
            ExpressionAttributeNames: {
                "#status": "status"
            },
            ExpressionAttributeValues: {
                ":status": "delete",
            },
        }
        return db.update(params)
            .promise()
            .then((res) => {
                return response(res, "success", 200)
            })
    }

};

module.exports.get = async (event, context, callback) => {
    const id = event.pathParameters.id;
    return db.scan(
        {
            TableName: TableName,
            FilterExpression: '#eventId = :eventId',
            ExpressionAttributeNames: {
                '#eventId': 'eventId',
            },
            ExpressionAttributeValues: {
                ':eventId': id,
            }
        }
    ).promise()
        .then((res) => {
            if (res.Count == 0) return response("", "event not exist or finished", 400)
            return response(res, "success", 200)
        })
        .catch((err) => {
            return response("", "server error", 500)
        })
};

module.exports.getAll = async (event, context, callback) => {
    const params = {
        TableName: TableName,
        FilterExpression: '#status = :status',
        ExpressionAttributeNames: {
            '#status': 'status',
        },
        ExpressionAttributeValues: {
            ':status': "active",
        },
    }
    return db.scan(params)
        .promise()
        .then((res) => {
            return response(res, "success", 200)
        })
        .catch((err) => {
            return response("", err, 500)
        })
};

module.exports.spin = async (event, context, callback) => {
    console.log(1)
    const params = {
        TableName: TableName,
        FilterExpression: '#status = :status',
        ExpressionAttributeNames: {
            '#status': 'status',
        },
        ExpressionAttributeValues: {
            ':status': "active",
        },
    }
    db.scan(params)
        .promise()
        .then((res) => {
            // console.log(res.Items)
            res.Items.forEach(r => {
                if (r.currentPoint / r.totalPoint >= 0.5) {
                    console.log(1)
                    const id = r.eventId;
                    db.scan(
                        {
                            TableName: dealTable,
                            FilterExpression: '#eventId = :eventId',
                            ExpressionAttributeNames: {
                                '#eventId': 'eventId',
                            },
                            ExpressionAttributeValues: {
                                ':eventId': id,
                            }
                        }
                    ).promise()
                        .then((result) => {
                            var kq = Math.floor(Math.random() * r.currentPoint);
                            result.Items.forEach(item => {
                                if (kq > item.beginNumber && kq < item.endNumber) {
                                    addNotification(item.userId, {
                                        eventId: r.eventId,
                                        content: 'ban la nguoi chien thang'
                                    })
                                    db.update({
                                        TableName: TableName,
                                        Key: {
                                            eventId: id,
                                        },
                                        UpdateExpression: 'set #winner = :winner, #status = :status',
                                        ExpressionAttributeNames: {
                                            "#winner": "winner",
                                            "#status": "status"
                                        },
                                        ExpressionAttributeValues: {
                                            ":winner": item.userId,
                                            ":status": "finish"
                                        },
                                    })
                                        .promise()
                                }
                            })
                        })
                        .catch((err) => {
                            console.log(err)
                        })
                }
            });
        })
    // .catch((err) => {
    //     return response("", err, 500)
    // })
};

module.exports.update = async (event, context, callback) => {
    let user = context.prev;
    if (user.role != "admin") {
        return response("", "no permision", 500)
    } else {
        const id = event.pathParameters.id;
        return db.scan({
            TableName: TableName,
            FilterExpression: '#eventId = :eventId',
            ExpressionAttributeNames: {
                '#eventId': 'eventId',
            },
            ExpressionAttributeValues: {
                ':eventId': id,
            },
        }).promise()
            .then(res => {
                if (res.Count == 0) return response("", "event not exist")
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
                        eventId: id,
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

    }

};