import bcrypt from "bcrypt";
import {NextFunction, Request, Response} from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/user';
import mailer from 'nodemailer';
import smtpTransport from 'nodemailer-smtp-transport';
import RequestError from "../middlewares/request-error";

import {validationResult} from "express-validator";

const sendForgotPasswordMail = (code: string, email: string) => {
    let transporter = mailer.createTransport(smtpTransport({
        service: 'gmail',
        host: 'smtp.gmail.com',
        auth: {
            user: process.env.EMAIL_NAME,
            pass: process.env.EMAIL_PASS
        }
    }));

    const mailOptions = {
        from: process.env.EMAIL_NAME,
        to: email,
        subject: '',
        text: `${code} 
        Use this as a temporary password, please change it when you login. 
        We will not be responsible if it is leaked.`
    };
    transporter.sendMail(mailOptions, function (error: Error) {
        if (error) {
            console.log(error);
        } else {
            console.log("Mail sent");
        }
    });
}

// signUp
const signUp = async (req: Request, res: Response, next: NextFunction) => {

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        let params = "";
        errors.array().forEach((e: any) => {
            params += `${e.param}, `
        });
        params += "triggered the error!!";
        return next(
            new RequestError(params, 422)
        );
    }
    const {firstName, lastName, email, password, mobile, university} = req.body;
    let existingUser;
    try {
        existingUser = await User.findOne({email: email});
    } catch (err) {
        const error = new RequestError("Error querying database", 500, err);
        return next(error);
    }

    if (existingUser) {
        const error = new RequestError('User exists already, please login instead.', 422);
        return next(error);
    }

    let hashedPassword;
    try {
        hashedPassword = await bcrypt.hash(password, 12);
    } catch (err) {
        const error = new RequestError('Could not create user, please try again.', 500, err);
        return next(error);
    }
    const date = Date().toLocaleString();


    let filePath;
    try {
        if (req.file) {
            filePath = req.file.path;
        } else {
            filePath = 'uploads/images/DUser.jpeg'
        }
    } catch (err) {
        console.log(err);
        const error = new RequestError(err.message, err.code, err);
        return next(error);
    }

    const createdUser = new User({
        firstName,
        lastName,
        email: email,
        image: 'https://win75.herokuapp.com/' + filePath,
        password: hashedPassword,
        mobile,
        university,
        joinDate: date,
    });
    try {
        await createdUser.save();
    } catch (err) {
        const error = new RequestError("Error creating user", 500, err);
        return next(error);
    }

    let token;
    try {
        token = jwt.sign(
            {userId: createdUser.id, email: createdUser.email},
            process.env.JWT_KEY, {
                expiresIn: '2d' // expires in 2d
            }
        );
    } catch (err) {
        const error = new RequestError('Signing up failed, please try again later.', 500, err);
        return next(error);
    }

    // Delete password from local createdUser variable to avoid sending it to the User.
    let createdUserObj = createdUser.toObject();
    delete createdUserObj.password;

    await res
        .status(201)
        .json({"status": "success", user: createdUserObj, email: createdUserObj.email, token: token});
};

// login
const login = async (req: Request, res: Response, next: NextFunction) => {

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        let params = "";
        errors.array().forEach((e: any) => {
            params += `${e.param}, `
        });
        params += "triggered the error!!";
        return next(
            new RequestError(params, 422)
        );
    }

    const {email, password} = req.body;
    let existingUser;

    try {
        existingUser = await User.findOne({email: email});
    } catch (err) {
        const error = new RequestError(
            err.message,
            500
        );
        return next(error);
    }

    if (!existingUser) {
        const error = new RequestError(
            'You are not registered!!!',
            403
        );
        return next(error);
    }

    let isValidPassword = false;
    try {
        isValidPassword = await bcrypt.compare(password, existingUser.password);
    } catch (err) {
        const error = new RequestError(
            'Could not log you in, please check your credentials and try again.',
            500
        );
        return next(error);
    }

    if (!isValidPassword) {
        const error = new RequestError(
            'Incorrect password entered.',
            403
        );
        return next(error);
    }

    let token;
    try {
        token = jwt.sign(
            {userId: existingUser.id, email: existingUser.email,},
            process.env.JWT_KEY,
        );
    } catch (err) {
        const error = new RequestError(
            'Logging in failed, please try again later.',
            500
        );
        return next(error);
    }

    const existingUserObj = existingUser.toObject();
    // Delete password from local existingUser variable to avoid sending it to the User.
    delete existingUserObj.password;
    await res.json({
        "status": "success",
        "user": existingUserObj,
        "token": token
    });
};

//todo: fix nodemailer
const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        let params = "";
        errors.array().forEach((e: any) => {
            params += `${e.param}, `
        });
        params += "triggered the error!!";
        return next(
            new RequestError(params, 422)
        );
    }
    const email = req.body.email;
    console.log(email);
    let password = Math.random().toString().substring(0, 3) + Math.random().toString().slice(0, 3) + 'hult';
    let user;
    try {
        user = await User.findOne({
            email
        });
    } catch (err) {
        const error = new RequestError("Something went wrong, please try again later.", err.status);
        return next(error);
    }
    if (!user) {
        const error = new RequestError(
            'You are not registered!!!',
            403
        );
        return next(error);
    }
    try {
        await sendForgotPasswordMail(password, email);
    } catch (err) {
        const error = new RequestError(
            'Error in sending mail!!!',
            500
        );
        return next(error);
    }

    let hashedPassword;
    try {
        hashedPassword = await bcrypt.hash(password, 12);
    } catch (err) {
        const error = new RequestError(
            'Could not create user, please try again.',
            500
        );
        return next(error);
    }
    user.password = hashedPassword;
    try {
        await user.save();
    } catch (err) {
        const error = new RequestError("Error saving user, try again later.", err.status);
        return next(error);
    }
    res.status(200).json({
        message: "Password updated"
    });
};

const changePassword = async (req: Request, res: Response, next: NextFunction) => {

    const userId = req.userData.userId;
    console.log(userId);
    let user;
    try {
        user = await User.findById(userId)
    } catch (err) {
        const error = new RequestError("Something went wrong can't get user.", 500);
        return next(error);
    }
    if (!user) {
        const error = new RequestError("Can't find user for provided id", 404);
        return next(error);
    }
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        let params = "";
        errors.array().forEach((e: any) => {
            params += `${e.param}, `
        });
        params += "triggered the error!!";
        return next(
            new RequestError(params, 422)
        );
    }
    const newPassword = req.body.newPassword;
    const currentPassword = req.body.currentPassword;
    let isValidPassword = false;
    try {
        isValidPassword = await bcrypt.compare(currentPassword, user.password);
    } catch (err) {
        const error = new RequestError(
            'Could not log you in, please check your credentials and try again.',
            500
        );
        return next(error);
    }

    if (!isValidPassword) {
        const error = new RequestError(
            'Wrong Password!!',
            403
        );
        return next(error);
    }
    let hashedPassword;
    try {
        hashedPassword = await bcrypt.hash(newPassword, 12);
    } catch (err) {
        const error = new RequestError(
            'Could not update password, please try again.',
            500
        );
        return next(error);
    }
    user.password = hashedPassword;
    try {
        await user.save();
    } catch (err) {
        const error = new RequestError("Error saving user, try again later.", err.status);
        return next(error);
    }

    res.status(200).json({
        message: "Password updated"
    });
};

exports.forgotPassword = forgotPassword;
exports.changePassword = changePassword;
exports.signUp = signUp;
exports.login = login;
