const jwtHelper = require('../init/jwt')
const config = require('../Config/config')
const debug = console.log.bind(console);
const accessTokenSecret = config.accessTokenSecret
const {res} = require("../init/res");
/**
 * Middleware: Authorization user by Token
 * @param {*} req 
 * @param {*} res 
 * @param {*} next 
 */

 module.exports.isAuth = async (event, context, callback) => {
    const tokenFromClient =  event.headers["Authorization"] ;
    if (tokenFromClient) {
        // Nếu tồn tại token
        try {
            // Thực hiện giải mã token xem có hợp lệ hay không?
            const decoded = await jwtHelper.verifyToken(tokenFromClient, accessTokenSecret);
            // Nếu token hợp lệ, lưu thông tin giải mã được vào đối tượng req, dùng cho các xử lý ở phía sau.
            // req.jwtDecoded = decoded;
            // Cho phép req đi tiếp sang controller.
            return decoded
        } catch (error) {
            // Nếu giải mã gặp lỗi: Không đúng, hết hạn...etc:
            // Lưu ý trong dự án thực tế hãy bỏ dòng debug bên dưới, mình để đây để debug lỗi cho các bạn xem thôi
            debug("Error while verify token:", error);
            console.log(2)
            return 402
        }
    } else {
        // Không tìm thấy token trong request
        return 403;
    }
}