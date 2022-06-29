'use strict';
const { response } = require("../init/res");
const db = require('../init/db');
const { uuid } = require("uuidv4");
const { convertData } = require("../init/convertData")
const { addNotification } = require('../init/addNotification')
const winner = require('./winner')
const fields = {
    eventId: { type: String, default: uuid() },
    productId: { type: String },
    eventName: { type: String },
    productName: { type: String },
    description: { type: String, default: '' },
    category: { type: String },
    image: { type: String },
    status: { type: String, default: 'active' },
    price: { type: Number },
    phien: { type: Number },
    currentPoint: { type: Number, default: 0 },
    totalPoint: { type: Number },
    winnerNumber: { type: Number, default: 0 },
    winner: { type: String, default: null },
    createdAt: { type: Date, default: new Date().toISOString() },
    updatedAt: { type: Date, default: new Date().toISOString() }
};
// const axios = require("axios");
const TableName = process.env.EVENT_TABLE;
const dealTable = process.env.DEAL_TABLE;
const productTable = process.env.PRODUCT_TABLE;
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

module.exports.createEvent = async (item) => {
    console.log(item)
    db.get({
        TableName: productTable,
        Key: {
            productId: item.productId,
        },
    }).promise().then(res => {
        if (res.Item.quantity > 0) {
            let data = {}
            if (new Date(item.createdAt).getDate() === new Date().getDate()) {
                data.eventName = 'Phiên ' + (item.phien + 1) + '-' + new Date().getDate() + (new Date().getMonth() + 1) + new Date().getUTCFullYear() + ': ' + item.productName;
                data.price = item.price
                data.description = item.description
                data.image = item.image
                data.productName = item.productName
                data.productId = item.productId
                data.totalPoint = item.totalPoint
                data.category = item.category
                data.phien = item.phien + 1;
                data = convertData(fields, data)
                // console.log(data)
            } else {
                data.eventName = 'Phiên 1 - ' + new Date().getDate() + (new Date().getMonth() + 1) + new Date().getUTCFullYear() + ': ' + item.productName;
                data.price = item.price
                data.description = item.description
                data.image = item.image
                data.productId = item.productId
                data.productName = item.productName
                data.totalPoint = item.totalPoint
                data.category = item.category
                data.phien = 1;
                data = convertData(fields, data)
                // console.log(data)
            }
            db.update({
                TableName: productTable,
                Key: {
                    productId: item.productId,
                },
                UpdateExpression: 'set #quantity = :quantity',
                ExpressionAttributeNames: {
                    "#quantity": "quantity"
                },
                ExpressionAttributeValues: {
                    ":quantity": res.Item.quantity - 1,
                },
            })
                .promise()
            return db.put(
                {
                    TableName: TableName,
                    Item: data,
                }
            ).promise()

        }
    })
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
            return response(res.Items[0], "success", 200)
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
                    // console.log(r)
                    this.createEvent(r)
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
                            result.Items.forEach(async (item) => {
                                if (kq > item.beginNumber && kq < item.endNumber) {
                                    await addNotification(item.userId, {
                                        eventId: r.eventId,
                                        content: 'Chúc mừng bạn là người chiến thắng sự kiện ' + r.eventName + ' với con số may mắn ' + kq,
                                        image: r.image
                                    });
                                    winner.push({
                                        eventId: r.eventId,
                                        userId: item.userId,
                                        username: item.username,
                                        eventName: r.eventName,
                                        image: r.image,
                                        eventPrice: r.price,
                                        point: item.point,
                                        result: kq
                                    })
                                    // console.log(item.userId)
                                    db.update({
                                        TableName: TableName,
                                        Key: {
                                            eventId: id,
                                        },
                                        UpdateExpression: 'set #winner = :winner, #status = :status, #winnerNumber = :winnerNumber',
                                        ExpressionAttributeNames: {
                                            "#winner": "winner",
                                            "#status": "status",
                                            "#winnerNumber": "winnerNumber"
                                        },
                                        ExpressionAttributeValues: {
                                            ":winner": item.username,
                                            ":status": "finish",
                                            ":winnerNumber": kq
                                        },
                                    })
                                        .promise()
                                } else {
                                    // console.log(1)
                                    await addNotification(item.userId, {
                                        eventId: r.eventId,
                                        content: 'Sự kiện ' + r.eventName + ' đã kết thúc với con số may mắn ' + kq + '.Chúc bạn may mắn lần sau',
                                        image: r.image
                                    })
                                }
                            })
                        })
                        .catch((err) => {
                            console.log(err)
                        })
                    // console.log(new Date().getDate - new Date(r.createdAt).getDate())
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