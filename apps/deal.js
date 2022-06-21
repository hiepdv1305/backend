'use strict';
const { response } = require("../init/res");
const db = require('../init/db');
const { uuid } = require("uuidv4");
const { convertData } = require("../init/convertData")
const { addNotification } = require('../init/addNotification')
const TableName = process.env.DEAL_TABLE;
const eventTable = process.env.EVENT_TABLE;
const userTable = process.env.USER_TABLE
const fields = {
    dealId: { type: String, default: uuid() },
    eventId: { type: String },
    userId: { type: String },
    username: { type: String },
    eventName: { type: String },
    image: { type: String },
    eventPrice: { type: Number },
    price: { type: Number },
    beginNumber: { type: Number },
    endNumber: { type: Number },
    point: { type: Number },
    createdAt: { type: Date, default: new Date().toISOString() },
    updatedAt: { type: Date, default: new Date().toISOString() }
};
module.exports.create = async (event, context, callback) => {
    let user = context.prev;
    console.log(user)
    let data = JSON.parse(event.body);
    return db.get({
        TableName: userTable,
        Key: {
            userId: user.userId,
        },
    }).promise().then(res => {
        if (res.Item.amout < data.price) return response("", "Số dư tài khoản không đủ để thực hiện giao dịch", 500)
        console.log(res)
        db.update({
            TableName: userTable,
            Key: {
                userId: user.userId,
            },
            UpdateExpression: 'set #amout = :amout',
            ExpressionAttributeNames: {
                "#amout": "amout"
            },
            ExpressionAttributeValues: {
                ":amout": res.Item.amout - data.price,
            },
        }).promise()
        return db.get({
            TableName: eventTable,
            Key: {
                eventId: data.eventId,
            },
        }).promise().then(res => {
            console.log(res)
            if (res.Item.currentPoint + data.point > res.Item.totalPoint) return response("", "Số điểm vượt quá số lượng còn lại", 500)
            db.update({
                TableName: eventTable,
                Key: {
                    eventId: data.eventId,
                },
                UpdateExpression: 'set #currentPoint = :currentPoint',
                ExpressionAttributeNames: {
                    "#currentPoint": "currentPoint"
                },
                ExpressionAttributeValues: {
                    ":currentPoint": res.Item.currentPoint + data.point,
                },
            }).promise()
            console.log(res)
            data.beginNumber = res.Item.currentPoint + 1
            data.endNumber = res.Item.currentPoint + data.point
            data.userId = user.userId
            data.username = user.username
            data = convertData(fields, data)
            console.log(data)
            return db.put({
                TableName: TableName,
                Item: data
            }).promise().then(res => {
                addNotification(user.userId, {
                    eventId: data.eventId,
                    content: 'Bạn đã mua thành công ' + data.point + ' điểm trong sự kiện ' + data.eventName,
                    image: data.image
                })
                return response("", "success", 200)
            })
        })
    })
};
module.exports.createDeal = async (event, context, callback) => {
    let user = context.prev;
    let data = JSON.parse(event.body);
    data.userId = user.userId
    data.username = user.username
    data = convertData(fields, data)
    console.log(data)
    await db.transactGet({
        TransactItems: [
            {
                Get: {
                    TableName: eventTable,
                    Key: {
                        HashKey: data.eventId,
                    },
                },
            },
            {
                Get: {
                    TableName: userTable,
                    Key: {
                        HashKey: user.userId,
                    },
                },
            },
        ],
    })
        .promise().then(res => {
            console.log(res)
        })
        .catch(err => {
            console.log(err)
        })
    // db.transactWrite({
    //     TransactItems: [
    //         {
    //             update: {
    //                 TableName: eventTable,
    //                 Key: {
    //                     eventId: data.eventId,
    //                 },
    //                 UpdateExpression: 'set #currentPoint = :currentPoint',
    //                 ExpressionAttributeNames: {
    //                     "#currentPoint": "currentPoint"
    //                 },
    //                 ExpressionAttributeValues: {
    //                     ":currentPoint": res.Items[0].currentPoint + data.point,
    //                 },
    //             }
    //         }
    //     ]
    // })
};
module.exports.eventGet = async (event, context, callback) => {
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
            return response(res, "success", 200)
        })
        .catch((err) => {
            return response("", "server error", 500)
        })
};

module.exports.userGet = async (event, context, callback) => {
    let user = context.prev;
    return db.scan(
        {
            TableName: TableName,
            FilterExpression: '#userId = :userId',
            ExpressionAttributeNames: {
                '#userId': 'userId',
            },
            ExpressionAttributeValues: {
                ':userId': user.userId,
            }
        }
    ).promise()
        .then((res) => {
            return response(res, "success", 200)
        })
        .catch((err) => {
            return response("", "server error", 500)
        })
};