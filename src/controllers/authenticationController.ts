// OPE Server
// Copyright (C) 2020-2023  Motagamwala Taha Arif Ali

// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.
import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { hash, compare } from 'bcryptjs';
import { decodeJwt } from 'jose';
import { randomBytes } from 'crypto';

import { Admin, Moderator, Examinee } from '../database/schema/userSchema';
import { Notification } from '../database/schema/notificationSchema';
import { New, Update } from '../storage/storage';
import { generateTokens } from '../helpers/generateTokenKeys';
import { sendcom } from '../communication/comm';
import {
  adminInterface,
  examineeInterface,
  moderatorInterface,
} from '../database/interface';
import { check } from '../helpers/checkTokens';
import { Encrypt, Decrypt } from '../helpers/encrypt_decrypt';

const base64URLEncode = (str: Buffer) => {
  return str
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
};

const register = async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    const fullName: string = req.body.name;
    const comid: string = req.body.comid;
    const type: string = req.body.type;
    const password: string | undefined = req.body.password;
    const confirmPassword: string | undefined = req.body.confirmPassword;
    const encname = Encrypt(fullName);
    const enccomid = Encrypt(comid);
    const code = randomBytes(256).readUInt32BE().toString();
    const dd = new Date();
    let registeringUser:
      | adminInterface
      | examineeInterface
      | moderatorInterface;
    if (type === 'ADMIN') {
      const user = await Admin.findOne({ type: 'ADMIN' });
      if (user) {
        return res.status(404).json({ error: 'Admin already exists' });
      }
      if (password !== confirmPassword) {
        return res.status(400).json({ error: 'Registration failed' });
      }
      const hashPassword = await hash(req.body.password, 13);
      registeringUser = await Admin.create({
        comid: Buffer.concat([enccomid[2], enccomid[0], enccomid[1]]),
        name: Buffer.concat([encname[2], encname[0], encname[1]]),
        type: type,
        password: hashPassword,
        verified: false,
        DeleteNVUserAfter: new Date(dd.getTime() + 60 * 60000),
      });
    } else if (type === 'MODERATOR') {
      const password = req.body.password;
      const confirmPassword = req.body.confirmPassword;
      if (password !== confirmPassword) {
        return res.status(400).json({ error: 'Registration failed' });
      }
      const hashPassword = await hash(req.body.password, 13);
      registeringUser = await Moderator.create({
        comid: Buffer.concat([enccomid[2], enccomid[0], enccomid[1]]),
        name: Buffer.concat([encname[2], encname[0], encname[1]]),
        type: type,
        password: hashPassword,
        status: 'Not Verified',
        verified: false,
        DeleteNVUserAfter: new Date(dd.getTime() + 60 * 60000),
      });
    } else if (type === 'EXAMINEE') {
      registeringUser = await Examinee.create({
        comid: Buffer.concat([enccomid[2], enccomid[0], enccomid[1]]),
        name: Buffer.concat([encname[2], encname[0], encname[1]]),
        type: type,
        status: 'Not Verified',
        verified: false,
        DeleteNVUserAfter: new Date(dd.getTime() + 60 * 60000),
      });
    } else {
      return res.status(400).json({ error: 'Registration failed' });
    }
    const hashCode = await hash(code, 10);
    registeringUser.verification = hashCode;
    await registeringUser.save();
    await sendcom(
      comid,
      'OTP for user verification',
      {
        logo: `${process.env.serverurl}public/logo/`,
        code: code,
      },
      'UVCODE'
    );
    return res.status(200).json({
      message: 'Registration successful',
      id: registeringUser._id,
      type: registeringUser.type,
    });
  } catch (error) {
    return res.status(400).json({ error: 'Registration failed' });
  }
};

const login = async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    const id: string = req.body.id;
    const password: string = req.body.password;
    let user = await Admin.findById(id);
    if (user !== null && user.type === 'MODERATOR') {
      user = await Moderator.findById(id);
    } else if (user !== null && user.type === 'EXAMINEE') {
      user = await Examinee.findById(id);
    }
    if (user === null) {
      return res.status(400).json({ error: 'This user does not exists' });
    }

    if (user.oauth === undefined) {
      return res.status(400).json({ error: 'Signin failed' });
    }

    if (await compare(password, user.password)) {
      const code = base64URLEncode(randomBytes(200));
      const hashCode = await hash(code, 10);
      user.oauth.code = hashCode;
      await user.save();
      return res.status(302).json({
        state: req.params.state,
        code: code,
      });
    } else {
      user.oauth = undefined;
      await user.save();
      return res.status(400).json({ error: 'id or password is not correct' });
    }
  } catch (error) {
    return res.status(400).json({ error: 'Signin failed' });
  }
};

const userverification = async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    const id = req.params.id;
    const type: string = req.params.type;
    const code: string = req.body.code;
    let user;
    if (type === 'ADMIN') {
      user = await Admin.findById(id);
      if (user === null) {
        return res.status(400).json({ error: 'This user does not exists' });
      }
      if (user.verification === undefined) {
        return res.status(400).json({ error: 'Verification failed' });
      }
      if (await compare(code, user.verification)) {
        user.verification = undefined;
        user.DeleteNVUserAfter = undefined;
        user.verified = true;
        const array = generateTokens();
        user.oauthppk = Buffer.concat([array[2], array[0], array[1]]);
        await user.save();
        return res.status(200).json({ message: 'Verification successful' });
      } else {
        return res.status(400).json({ message: 'Verification failed' });
      }
    } else if (type === 'MODERATOR') {
      if (req.files === undefined) {
        return res.status(400).json({ error: 'Verification failed' });
      }
      if (Array.isArray(req.files)) {
        return res.status(400).json({ error: 'Verification failed' });
      }
      const admin = await Admin.findOne({ type: 'ADMIN' });
      if (admin === null) {
        return res.status(400).json({ error: 'Verification failed' });
      }
      user = await Moderator.findById(id);
      if (user === null) {
        return res.status(400).json({ error: 'This user does not exists' });
      }
      if (user.verification === undefined) {
        return res.status(400).json({ error: 'Verification failed' });
      }
      if (req.files.images.length !== 2) {
        return res.status(400).json({ error: 'Verification failed' });
      }
      if (await compare(code, user.verification)) {
        user.verification = undefined;
        const iobject = [];
        const files = req.files.images;
        for (let i = 0; i < files.length; i++) {
          iobject.push({
            name:
              i === 0
                ? `${user._id}_PHOTO_.${files[i].mimetype.split('/')[1]}`
                : `${user._id}_PROOF_.${files[i].mimetype.split('/')[1]}`,
            id: await New(
              files[i].buffer,
              files[i].mimetype.split('/')[1],
              i === 0 ? `${user._id}_PHOTO_` : `${user._id}_PROOF_`
            ),
          });
        }
        user.image = iobject;
        if (admin.Isloggedin) {
          user.notify = true;
        }
        user.status = 'Pending Verification';
        user.DeleteNVUserAfter = undefined;
        await user.save();
        await Notification.create({
          UserId: admin._id,
          type: 'Notification',
          Date: new Date(),
          title: 'New Moderator',
          mark: false,
          notify: admin.Isloggedin === true ? true : undefined,
          detail: `New moderator has verified itself on ${new Date()} and has now applied for admin verification you will find the new moderator on the moderator page in pending verification tab`,
        });
        return res.status(200).json({
          message:
            'User verification successful please wait for admin to verify your profile',
        });
      } else {
        return res.status(400).json({ message: 'Verification failed' });
      }
    } else if (type === 'EXAMINEE') {
      if (req.files === undefined) {
        return res.status(400).json({ error: 'Verification failed' });
      }
      if (Array.isArray(req.files)) {
        return res.status(400).json({ error: 'Verification failed' });
      }
      const admin = await Admin.findOne({ type: 'ADMIN' });
      if (admin === null) {
        return res.status(400).json({ error: 'Verification failed' });
      }
      user = await Examinee.findById(id);
      if (user === null) {
        return res.status(400).json({ error: 'This user does not exists' });
      }
      if (user.verification === undefined) {
        return res.status(400).json({ error: 'Verification failed' });
      }
      if (req.files.images.length !== 2) {
        return res.status(400).json({ error: 'Verification failed' });
      }
      if (await compare(code, user.verification)) {
        user.verification = undefined;
        const iobject = [];
        const files = req.files.images;
        for (let i = 0; i < files.length; i++) {
          iobject.push({
            name:
              i === 0
                ? `${user._id}_PHOTO_.${files[i].mimetype.split('/')[1]}`
                : `${user._id}_PROOF_.${files[i].mimetype.split('/')[1]}`,
            id: await New(
              files[i].buffer,
              files[i].mimetype.split('/')[1],
              i === 0 ? `${user._id}_PHOTO_` : `${user._id}_PROOF_`
            ),
          });
        }
        user.image = iobject;
        if (admin.Isloggedin) {
          user.notify = true;
        }
        user.status = 'Pending Verification';
        user.DeleteNVUserAfter = undefined;
        await user.save();
        await Notification.create({
          UserId: admin._id,
          type: 'Notification',
          Date: new Date(),
          title: 'New Examinee',
          mark: false,
          detail: `New examinee has verified itself on ${new Date()} and has now applied for admin verification you will find the new examinee on the examinee page in pending verification tab`,
          notify: admin.Isloggedin === true ? true : undefined,
        });
        return res.status(200).json({
          message:
            'User verification successful please wait for admin to verify your profile',
        });
      } else {
        return res.status(400).json({ message: 'Verification failed' });
      }
    } else {
      return res.status(400).json({ error: 'Verification failed' });
    }
  } catch (error) {
    return res.status(400).json({ error: 'Verification failed' });
  }
};

const logout = async (req: Request, res: Response) => {
  const authToken = req.get('Authorization');
  if (authToken === undefined) {
    return res.status(401).json({ error: 'Malformed request' });
  }
  try {
    const decodedToken = decodeJwt(authToken.split(' ')[1]);
    let user;
    if (decodedToken.userType === 'MODERATOR') {
      user = await Moderator.findById(decodedToken.userId);
    } else if (decodedToken.userType === 'ADMIN') {
      user = await Admin.findById(decodedToken.userId);
    } else if (decodedToken.userType === 'EXAMINEE') {
      user = await Examinee.findById(decodedToken.userId);
    } else {
      return res.status(401).json({ error: 'Failed to signout' });
    }
    if (user === null) {
      return res.status(401).json({ error: 'Failed to signout' });
    }
    if ((await check(user, authToken.split(' ')[1], 'Access')) === false) {
      return res.status(401).json({ error: 'Failed to verify token' });
    }
    if (user.Isloggedin === false) {
      const admin = await Admin.findOne({ type: 'ADMIN' });
      if (admin === null) {
        process.exit(1);
      }
      const array = generateTokens();
      user.oauthppk = Buffer.concat([array[2], array[0], array[1]]);
      await user.save();
      await Notification.create({
        UserId: admin._id,
        type: 'Issue',
        Date: new Date(),
        severity: 'Critical',
        mark: false,
        title: 'Security Breach',
        notify: admin.Isloggedin === true ? true : undefined,
        detail: `One of the user ${user._id} was compromised. Necessary actions has been taken to secure the users account. Please review all the security details of your system`,
      });
      return res.status(401).json({ error: 'Failed to signout' });
    }
    user.Isloggedin = false;
    user.tid = undefined;
    user.LogoutUserAfter = undefined;
    await user.save();
    return res.status(200).json({ msg: 'Signout successful' });
  } catch (error) {
    return res.status(401).json({ error: 'Failed to signout' });
  }
};

const review = async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    const type: Array<string> = JSON.parse(req.body.type).type;
    const id = req.params.id;
    const code = req.params.code;
    if (req.files === undefined) {
      return res.status(400).json({ error: 'Review failed' });
    }
    if (Array.isArray(req.files)) {
      return res.status(400).json({ error: 'Review failed' });
    }
    if (req.files.images.length !== 2) {
      return res.status(400).json({ error: 'Review failed' });
    }
    const images = req.files.images;
    let user = await Examinee.findById(id);
    if (user?.type === 'MODERATOR') {
      user = await Moderator.findById(id);
    }
    if (user === null) {
      return res.status(400).json({ error: 'Review failed' });
    }
    if (user.verification === undefined) {
      return res.status(400).json({ error: 'Review failed' });
    }
    if (await compare(code, user.verification)) {
      const admin = await Admin.findOne({ type: 'ADMIN' });
      if (admin === null) {
        return res.status(400).json({ error: 'Review failed' });
      }
      for (let i = 0; i < type.length; i++) {
        const element = type[i];
        if (element === 'Problem with name') {
          const encname = Encrypt(req.body.name);
          user.name = Buffer.concat([encname[2], encname[0], encname[1]]);
          await user.save();
        } else if (element === 'Problem with photo') {
          user.image[0].id = await Update(
            images[0].buffer,
            user.image[0].id,
            images[0].mimetype.split('/')[1],
            user.image[0].name.split('.')[0]
          );
          await user.save();
        } else if (element === 'Problem with ID proof') {
          user.image[1].id = await Update(
            images[1].buffer,
            user.image[1].id,
            images[1].mimetype.split('/')[1],
            user.image[1].name.split('.')[0]
          );
          await user.save();
        }
      }
      user.review = undefined;
      user.verification = undefined;
      user.status = 'Pending Verification';
      user.notify = admin.Isloggedin === true ? true : undefined;
      user.DeleteNVUserAfter = undefined;
      await user.save();
      await Notification.create({
        UserId: admin._id,
        type: 'Notification',
        Date: new Date(),
        title: `${user.type.toLocaleLowerCase()}'s has given new data for review`,
        mark: false,
        notify: admin.Isloggedin === true ? true : undefined,
        detail: `${user.type.toLocaleLowerCase()} whose account was disproved has given new data for review you will find the ${user.type.toLocaleLowerCase()} on the ${user.type.toLocaleLowerCase()} page in pending verification tab`,
      });
      return res.status(200).json({
        message:
          'Data saved successfully please wait for admin to approve the account',
      });
    } else {
      return res.status(400).json({ error: 'Review failed' });
    }
  } catch (error) {
    return res.status(400).json({ error: 'Review failed' });
  }
};

const verification = async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    const id = req.params.id;
    let user: adminInterface | moderatorInterface | examineeInterface | null;
    user = await Admin.findById(id);
    if (user?.type === 'MODERATOR') {
      user = await Moderator.findById(id);
    } else if (user?.type === 'EXAMINEE') {
      user = await Examinee.findById(id);
    }
    if (user === null) {
      return res.status(400).json({ error: 'Verification failed' });
    }
    if (
      user.change !== undefined &&
      user.change.commid !== undefined &&
      user.comid.toString() === 'EMPTY' &&
      user.verification !== undefined
    ) {
      if (await compare(req.body.code, user.verification)) {
        user.comid = user.change.commid;
        user.change = undefined;
        user.DeleteAccountChangeAfter = undefined;
        user.verification = undefined;
        await user.save();
        return res
          .status(200)
          .json({ message: 'Communication Id changed successfully' });
      } else {
        return res.status(400).json({ error: 'Verification failed' });
      }
    } else if (
      user.change !== undefined &&
      user.change.commid !== undefined &&
      user.verification !== undefined
    ) {
      if (await compare(req.body.code, user.verification)) {
        const code = randomBytes(256).toString('base64url');
        const dd = new Date();
        user.verification = await hash(code, 10);
        user.DeleteAccountChangeAfter = new Date(dd.getTime() + 60 * 60000);
        user.comid = Buffer.from('EMPTY');
        await user.save();
        await sendcom(
          Decrypt(
            user.change.commid.subarray(0, 32),
            user.change.commid.subarray(user.change.commid.length - 16),
            user.change.commid.subarray(32, user.change.commid.length - 16)
          ).toString(),
          'Verify new communication Id',
          {
            logo: `${process.env.serverurl}public/logo/`,
            name: Decrypt(
              user.name.subarray(0, 32),
              user.name.subarray(user.name.length - 16),
              user.name.subarray(32, user.name.length - 16)
            ).toString(),
            requestlink: `${process.env.client}#/verification/${code}/${user._id}`,
          },
          'EVCODE'
        );
        return res
          .status(200)
          .json({ message: 'Please verify your new communication Id' });
      } else {
        return res.status(400).json({ error: 'Verification failed' });
      }
    } else if (
      user.change !== undefined &&
      user.change.password !== undefined &&
      user.verification !== undefined
    ) {
      if (await compare(req.body.code, user.verification)) {
        user.password = user.change.password;
        user.change = undefined;
        user.DeleteAccountChangeAfter = undefined;
        user.verification = undefined;
        await user.save();
        return res
          .status(200)
          .json({ message: 'Password changed successfully' });
      } else {
        return res.status(400).json({ error: 'Verification failed' });
      }
    } else {
      return res.status(400).json({ error: 'Verification failed' });
    }
  } catch (error) {
    return res.status(400).json({ error: 'Verification failed' });
  }
};

const secure = async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    const id = req.params.id;
    let user: adminInterface | moderatorInterface | examineeInterface | null;
    user = await Admin.findById(id);
    if (user?.type === 'MODERATOR') {
      user = await Moderator.findById(id);
    } else if (user?.type === 'EXAMINEE') {
      user = await Examinee.findById(id);
    }
    if (user === null) {
      return res.status(400).json({ error: 'Failed to secure account' });
    }
    if (
      user.change !== undefined &&
      user.change.commid !== undefined &&
      user.verification !== undefined
    ) {
      if (await compare(req.body.code, user.verification)) {
        user.verification = undefined;
        user.change = undefined;
        user.DeleteAccountChangeAfter = undefined;
        await user.save();
        return res
          .status(200)
          .json({ message: 'Account secured successfully' });
      } else {
        return res.status(400).json({ error: 'Failed to secure account' });
      }
    } else if (
      user.change !== undefined &&
      user.change.password !== undefined &&
      user.verification !== undefined
    ) {
      if (await compare(req.body.code, user.verification)) {
        user.change = undefined;
        user.DeleteAccountChangeAfter = undefined;
        user.verification = undefined;
        await user.save();
        return res
          .status(200)
          .json({ message: 'Account secured successfully' });
      } else {
        return res.status(400).json({ error: 'Failed to secure account' });
      }
    }
    if (user.verification !== undefined) {
      if (await compare(req.body.code, user.verification)) {
        user.verification = undefined;
        user.deletePasswordrequestAfter = undefined;
        await user.save();
        return res
          .status(200)
          .json({ message: 'Account secured successfully' });
      } else {
        return res.status(400).json({ error: 'Failed to secure account' });
      }
    } else {
      return res.status(400).json({ error: 'Failed to secure account' });
    }
  } catch (error) {
    return res.status(400).json({ error: 'Failed to secure account' });
  }
};

const forgotpassword = async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    const id = req.params.idn;
    let user: adminInterface | moderatorInterface | examineeInterface | null;
    user = await Admin.findById(id);
    if (user?.type === 'MODERATOR') {
      user = await Moderator.findById(id);
    } else if (user?.type === 'EXAMINEE') {
      user = await Examinee.findById(id);
    }
    if (user === null) {
      return res
        .status(400)
        .json({ error: 'Cannot create reset password request' });
    }
    const code = randomBytes(256).toString('base64url');
    const dd = new Date();
    user.verification = await hash(code, 10);
    user.deletePasswordrequestAfter = new Date(dd.getTime() + 60 * 60000);
    await user.save();
    await sendcom(
      Decrypt(
        user.comid.subarray(0, 32),
        user.comid.subarray(user.comid.length - 16),
        user.comid.subarray(32, user.comid.length - 16)
      ).toString(),
      'Reset password request',
      {
        logo: `${process.env.serverurl}public/logo/`,
        name: Decrypt(
          user.name.subarray(0, 32),
          user.name.subarray(user.name.length - 16),
          user.name.subarray(32, user.name.length - 16)
        ).toString(),
        requestlink: `${process.env.client}#/reset_password/${code}/${user._id}`,
        securelink: `${process.env.client}#/secure/${code}/${user._id}`,
      },
      'RESETPASSWORD'
    );
    return res.status(200).json({
      message: 'Reset your password from link sent to your communication Id',
    });
  } catch (error) {
    return res
      .status(400)
      .json({ error: 'Cannot create reset password request' });
  }
};

const resetpassword = async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    const id = req.params.id;
    const password: string = req.body.password;
    const confirmPassword: string = req.body.confirmpassword;
    let user: adminInterface | moderatorInterface | examineeInterface | null;
    user = await Admin.findById(id);
    if (user?.type === 'MODERATOR') {
      user = await Moderator.findById(id);
    } else if (user?.type === 'EXAMINEE') {
      user = await Examinee.findById(id);
    }
    if (user === null) {
      return res.status(400).json({ error: 'Cannot reset password' });
    }
    if (user.verification !== undefined) {
      if (await compare(req.params.code, user.verification)) {
        if (password !== confirmPassword) {
          return res.status(400).json({ error: 'Cannot reset password' });
        }
        const hashPassword = await hash(req.body.password, 13);
        user.verification = undefined;
        user.deletePasswordrequestAfter = undefined;
        user.password = hashPassword;
        await user.save();
        return res.status(200).json({
          message: 'Password changed successfully',
        });
      } else {
        return res.status(400).json({ error: 'Cannot reset password' });
      }
    } else {
      return res.status(400).json({ error: 'Cannot reset password' });
    }
  } catch (error) {
    return res.status(400).json({ error: 'Cannot reset password' });
  }
};

export {
  register,
  login,
  logout,
  userverification,
  review,
  verification,
  secure,
  forgotpassword,
  resetpassword,
};
