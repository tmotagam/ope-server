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
import { NextFunction, Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { generate } from 'generate-password';
import { randomBytes } from 'crypto';
import { compare, hash } from 'bcryptjs';

import { Admin, Moderator, Examinee } from '../../database/schema/userSchema';
import { generateTokens } from '../../helpers/generateTokenKeys';
import { Delete, Get } from '../../storage/storage';
import { establishConnection } from '../../middlewares/sse';
import { Notification } from '../../database/schema/notificationSchema';
import { tokenCheck } from '../../middlewares/tokenVerifier';
import { Decrypt, Encrypt } from '../../helpers/encrypt_decrypt';
import { sendcom } from '../../communication/comm';

const notification = async (req: Request, res: Response) => {
  if (req.token === undefined) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    const admin = await Admin.findById(req.token.id);
    if (admin === null) {
      return res.status(400).json({ error: 'User not found' });
    }
    const notifications = await Notification.find({ UserId: admin._id });
    notifications.reverse();
    return res
      .status(200)
      .json({ notification: notifications.map((n) => n._id) });
  } catch (error) {
    return res.status(400).json({ error: 'Notifications not found' });
  }
};

const notification_details = async (req: Request, res: Response) => {
  if (req.token === undefined) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    const admin = await Admin.findById(req.token.id);
    if (admin === null) {
      return res.status(400).json({ error: 'User not found' });
    }
    const notifications: Array<{
      id: number;
      Id: string;
      Date: Date;
      type: string;
      severity?: string;
      mark: boolean;
      title: string;
      detail: string;
    }> = [];
    const ids = JSON.parse(req.params.ids);
    const crudenotifications = await Notification.find({
      $and: [
        {
          _id: {
            $in: ids.ids,
          },
        },
        { UserId: req.token.id },
      ],
    });
    crudenotifications.reverse();
    for (let i = 0; i < crudenotifications.length; i++) {
      const element = crudenotifications[i];
      notifications.push({
        id: i + 1,
        Id: element._id,
        title: element.title,
        detail: element.detail,
        type: element.type,
        severity: element.severity,
        mark: element.mark,
        Date: element.Date,
      });
    }
    return res.status(200).json({ notification: notifications });
  } catch (error) {
    return res.status(400).json({ error: 'Notifications not found' });
  }
};

const mark_notification = async (req: Request, res: Response) => {
  if (req.token === undefined) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    const admin = await Admin.findById(req.token.id);
    if (admin === null) {
      return res.status(400).json({ error: 'User not found' });
    }
    const id = req.params.id;
    const notification = await Notification.findOne({
      $and: [
        {
          _id: id,
        },
        { UserId: req.token.id },
        { mark: false },
      ],
    });
    if (notification === null) {
      return res.status(400).json({ error: 'Notification not found' });
    }
    notification.mark = true;
    await notification.save();
    return res.status(200).json({ message: 'Notification marked' });
  } catch (error) {
    return res.status(400).json({ error: 'Notification not found' });
  }
};

const unmark_notification = async (req: Request, res: Response) => {
  if (req.token === undefined) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    const admin = await Admin.findById(req.token.id);
    if (admin === null) {
      return res.status(400).json({ error: 'User not found' });
    }
    const id = req.params.id;
    const notification = await Notification.findOne({
      $and: [
        {
          _id: id,
        },
        { UserId: req.token.id },
        { mark: true },
      ],
    });
    if (notification === null) {
      return res.status(400).json({ error: 'Notification not found' });
    }
    notification.mark = false;
    await notification.save();
    return res.status(200).json({ message: 'Notification unmarked' });
  } catch (error) {
    return res.status(400).json({ error: 'Notification not found' });
  }
};

const delete_notification = async (req: Request, res: Response) => {
  if (req.token === undefined) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    const admin = await Admin.findById(req.token.id);
    if (admin === null) {
      return res.status(400).json({ error: 'User not found' });
    }
    const id = req.params.id;
    const notification = await Notification.findOneAndDelete({
      $and: [
        {
          _id: id,
        },
        { UserId: req.token.id },
        { mark: true },
      ],
    });
    if (notification === null) {
      return res.status(400).json({ error: 'Notification not found' });
    }
    return res.status(200).json({ message: 'Notification deleted' });
  } catch (error) {
    return res.status(400).json({ error: 'Notification not found' });
  }
};

const examinees = async (req: Request, res: Response) => {
  if (req.token === undefined) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    const examinees = await Examinee.find({
      type: 'EXAMINEE',
      $or: [
        {
          status: 'Verified',
        },
        {
          status: 'Pending Verification',
        },
      ],
    });
    examinees.reverse();
    return res.status(200).json({
      examineesIds: examinees.map((e) => e._id),
      examineesStatus: examinees.map((e) => e.status),
    });
  } catch (error) {
    return res.status(400).json({ error: 'Examinees not found' });
  }
};

const examinees_details = async (req: Request, res: Response) => {
  if (req.token === undefined) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    const ids = JSON.parse(req.params.ids);
    const status = req.params.status;
    const examinees: Array<{
      id: number;
      Id: string;
      name: string;
    }> = [];
    const crudeexaminees = await Examinee.find({
      $and: [
        {
          _id: {
            $in: ids.ids,
          },
        },
        { status: status },
        { review: undefined },
      ],
    });
    crudeexaminees.reverse();
    for (let i = 0; i < crudeexaminees.length; i++) {
      const element = crudeexaminees[i];
      examinees.push({
        id: i + 1,
        Id: element._id,
        name: Decrypt(
          element.name.subarray(0, 32),
          element.name.subarray(element.name.length - 16),
          element.name.subarray(32, element.name.length - 16)
        ).toString(),
      });
    }
    return res.status(200).json({ examinees: examinees });
  } catch (error) {
    return res.status(400).json({ error: 'Examinees not found' });
  }
};

const examinee_images = async (req: Request, res: Response) => {
  if (req.token === undefined) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    const id = req.params.id;
    const examinee = await Examinee.findById(id);
    if (examinee === null) {
      return res.status(400).json({ error: 'Examinee not found' });
    }
    const image0 = await Get(examinee.image[0].name);
    const image1 = await Get(examinee.image[1].name);
    return res
      .status(200)
      .json({ images: [image0.toString('base64'), image1.toString('base64')] });
  } catch (error) {
    return res.status(400).json({ error: 'Examinee not found' });
  }
};

const verify_examinee = async (req: Request, res: Response) => {
  if (req.token === undefined) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    const id = req.params.id;
    const examinee = await Examinee.findOne({
      $and: [
        {
          _id: id,
        },
        { verified: false },
        { status: 'Pending Verification' },
        { review: undefined },
      ],
    });
    if (examinee === null) {
      return res.status(400).json({ error: 'Examinee not found' });
    }
    examinee.verified = true;
    const array = generateTokens();
    const pass = generate({ numbers: true, symbols: true, strict: true });
    examinee.status = 'Verified';
    examinee.password = await hash(pass, 13);
    examinee.oauthppk = Buffer.concat([array[2], array[0], array[1]]);
    await examinee.save();
    await sendcom(
      Decrypt(
        examinee.comid.subarray(0, 32),
        examinee.comid.subarray(examinee.comid.length - 16),
        examinee.comid.subarray(32, examinee.comid.length - 16)
      ).toString(),
      'Account Approved Successfully',
      {
        logo: `${process.env.serverurl}public/logo/`,
        _id: examinee._id,
        name: Decrypt(
          examinee.name.subarray(0, 32),
          examinee.name.subarray(examinee.name.length - 16),
          examinee.name.subarray(32, examinee.name.length - 16)
        ).toString(),
        examinee: true,
        password: pass,
        dlink: `${process.env.client}#/download`,
        alink: process.env.client,
      },
      'APPROVE'
    );
    return res.status(200).json({ message: 'Examinee approved successfully' });
  } catch (error) {
    return res.status(400).json({ error: 'Examinee not found' });
  }
};

const disprove_examinee = async (req: Request, res: Response) => {
  if (req.token === undefined) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    const id = req.params.id;
    const examinee = await Examinee.findOne({
      $and: [
        {
          _id: id,
        },
        { review: undefined },
      ],
    });
    if (examinee === null) {
      return res.status(400).json({ error: 'Examinee not found' });
    }
    examinee.verified = false;
    examinee.status = 'InReview';
    examinee.oauthppk = Buffer.from('');
    const code = randomBytes(256).toString('base64url');
    examinee.review = {
      reviewReason: req.body.reason,
      reviewType: req.body.type,
    };
    const dd = new Date();
    examinee.verification = await hash(code, 10);
    examinee.DeleteNVUserAfter = new Date(dd.getTime() + 2880 * 60000);
    await examinee.save();
    await sendcom(
      Decrypt(
        examinee.comid.subarray(0, 32),
        examinee.comid.subarray(examinee.comid.length - 16),
        examinee.comid.subarray(32, examinee.comid.length - 16)
      ).toString(),
      'Account Disproved',
      {
        logo: `${process.env.serverurl}public/logo/`,
        name: Decrypt(
          examinee.name.subarray(0, 32),
          examinee.name.subarray(examinee.name.length - 16),
          examinee.name.subarray(32, examinee.name.length - 16)
        ).toString(),
        link: `${process.env.client}#/review/${code}/${examinee._id}/${req.body.type}`,
        reason: req.body.reason,
      },
      'REJECT'
    );
    return res.status(200).json({ message: 'Examinee disproved successfully' });
  } catch (error) {
    return res.status(400).json({ error: 'Examinee not found' });
  }
};

const delete_examinee = async (req: Request, res: Response) => {
  if (req.token === undefined) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    const id = req.params.id;
    const examinee = await Examinee.findByIdAndDelete(id);
    if (examinee === null) {
      return res.status(400).json({ error: 'Examinee not found' });
    }
    await Delete(examinee.image[0].id);
    await Delete(examinee.image[1].id);
    return res.status(200).json({ message: 'Examinee deleted successfully' });
  } catch (error) {
    return res.status(400).json({ error: 'Examinee not found' });
  }
};

const moderators = async (req: Request, res: Response) => {
  if (req.token === undefined) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    const moderators = await Moderator.find({
      type: 'MODERATOR',
      $or: [
        {
          status: 'Verified',
        },
        {
          status: 'Pending Verification',
        },
      ],
    });
    moderators.reverse();
    return res.status(200).json({
      moderatorsIds: moderators.map((e) => e._id),
      moderatorsStatus: moderators.map((e) => e.status),
    });
  } catch (error) {
    return res.status(400).json({ error: 'Moderators not found' });
  }
};

const moderators_details = async (req: Request, res: Response) => {
  if (req.token === undefined) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    const ids = JSON.parse(req.params.ids);
    const status = req.params.status;
    const moderators: Array<{
      id: number;
      Id: string;
      name: string;
    }> = [];
    const crudemoderators = await Moderator.find({
      $and: [
        {
          _id: {
            $in: ids.ids,
          },
        },
        { status: status },
        { review: undefined },
      ],
    });
    crudemoderators.reverse();
    for (let i = 0; i < crudemoderators.length; i++) {
      const element = crudemoderators[i];
      moderators.push({
        id: i + 1,
        Id: element._id,
        name: Decrypt(
          element.name.subarray(0, 32),
          element.name.subarray(element.name.length - 16),
          element.name.subarray(32, element.name.length - 16)
        ).toString(),
      });
    }
    return res.status(200).json({ moderators: moderators });
  } catch (error) {
    return res.status(400).json({ error: 'Moderators not found' });
  }
};

const moderator_images = async (req: Request, res: Response) => {
  if (req.token === undefined) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    const id = req.params.id;
    const moderator = await Moderator.findById(id);
    if (moderator === null) {
      return res.status(400).json({ error: 'Moderators not found' });
    }
    const image0 = await Get(moderator.image[0].name);
    const image1 = await Get(moderator.image[1].name);
    return res
      .status(200)
      .json({ images: [image0.toString('base64'), image1.toString('base64')] });
  } catch (error) {
    return res.status(400).json({ error: 'Moderators not found' });
  }
};

const verify_moderator = async (req: Request, res: Response) => {
  if (req.token === undefined) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    const id = req.params.id;
    const moderator = await Moderator.findOne({
      $and: [
        {
          _id: id,
        },
        { verified: false },
        { status: 'Pending Verification' },
        { review: undefined },
      ],
    });
    if (moderator === null) {
      return res.status(400).json({ error: 'Moderator not found' });
    }
    moderator.verified = true;
    const array = generateTokens();
    moderator.status = 'Verified';
    moderator.oauthppk = Buffer.concat([array[2], array[0], array[1]]);
    await moderator.save();
    await sendcom(
      Decrypt(
        moderator.comid.subarray(0, 32),
        moderator.comid.subarray(moderator.comid.length - 16),
        moderator.comid.subarray(32, moderator.comid.length - 16)
      ).toString(),
      'Account Approved Successfully',
      {
        logo: `${process.env.serverurl}public/logo/`,
        _id: moderator._id,
        name: Decrypt(
          moderator.name.subarray(0, 32),
          moderator.name.subarray(moderator.name.length - 16),
          moderator.name.subarray(32, moderator.name.length - 16)
        ).toString(),
        moderator: true,
      },
      'APPROVE'
    );
    return res.status(200).json({ message: 'Moderator approved successfully' });
  } catch (error) {
    return res.status(400).json({ error: 'Moderator not found' });
  }
};

const disprove_moderator = async (req: Request, res: Response) => {
  if (req.token === undefined) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    const id = req.params.id;
    const moderator = await Moderator.findOne({
      $and: [
        {
          _id: id,
        },
        { review: undefined },
      ],
    });
    if (moderator === null) {
      return res.status(400).json({ error: 'Moderator not found' });
    }
    moderator.verified = false;
    moderator.status = 'InReview';
    moderator.oauthppk = Buffer.from('');
    const code = randomBytes(256).toString('base64url');
    moderator.review = {
      reviewReason: req.body.reason,
      reviewType: req.body.type,
    };
    const dd = new Date();
    moderator.verification = await hash(code, 10);
    moderator.DeleteNVUserAfter = new Date(dd.getTime() + 2880 * 60000);
    await moderator.save();
    await sendcom(
      Decrypt(
        moderator.comid.subarray(0, 32),
        moderator.comid.subarray(moderator.comid.length - 16),
        moderator.comid.subarray(32, moderator.comid.length - 16)
      ).toString(),
      'Account Disproved',
      {
        logo: `${process.env.serverurl}public/logo/`,
        name: Decrypt(
          moderator.name.subarray(0, 32),
          moderator.name.subarray(moderator.name.length - 16),
          moderator.name.subarray(32, moderator.name.length - 16)
        ).toString(),
        link: `${process.env.client}#/review/${code}/${moderator._id}/${req.body.type}`,
        reason: req.body.reason,
      },
      'REJECT'
    );
    return res
      .status(200)
      .json({ message: 'Moderator disproved successfully' });
  } catch (error) {
    return res.status(400).json({ error: 'Moderator not found' });
  }
};

const delete_moderator = async (req: Request, res: Response) => {
  if (req.token === undefined) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    const id = req.params.id;
    const moderator = await Moderator.findByIdAndDelete(id);
    if (moderator === null) {
      return res.status(400).json({ error: 'Moderator not found' });
    }
    await Delete(moderator.image[0].id);
    await Delete(moderator.image[1].id);
    return res.status(200).json({ message: 'Moderator deleted successfully' });
  } catch (error) {
    return res.status(400).json({ error: 'Moderator not found' });
  }
};

const admin_event = async (req: Request, res: Response, next: NextFunction) => {
  try {
    establishConnection(res, 3000);
    tokenCheck(req, res, next);
    const admineventInterval = setInterval(async () => {
      const admin = await Admin.findOne({
        type: 'ADMIN',
      });
      if (admin === null) {
        return res.sse({
          data: 'user not found',
          event: 'ERROR',
        });
      }
      const notifications = await Notification.find({
        $and: [
          {
            UserId: admin._id,
          },
          {
            notify: true,
          },
        ],
      });
      const examinees = await Examinee.find({ notify: true });
      if (notifications.length !== 0 || examinees.length !== 0) {
        res.sse({
          data: {
            message: 'New users or notifications have arrived.',
            notifications: notifications.map((n) => n._id),
            users: {
              Ids: examinees.map((e) => e._id),
              Status: examinees.map((e) => e.status),
              Type: examinees.map((e) => e.type),
            },
          },
          event: 'ADMIN',
          id: admin._id,
        });
        for (let i = 0; i < notifications.length; i++) {
          const n = notifications[i];
          n.notify = undefined;
          await n.save();
        }
        for (let i = 0; i < examinees.length; i++) {
          const user = examinees[i];
          user.notify = undefined;
          await user.save();
        }
      }
    }, 1000);

    res.on('finish', () => clearInterval(admineventInterval));
    res.on('close', async () => {
      clearInterval(admineventInterval);
      const notifications = await Notification.find({
        $and: [
          {
            UserId: req.token?.id,
          },
          {
            notify: true,
          },
        ],
      });
      for (let i = 0; i < notifications.length; i++) {
        const n = notifications[i];
        n.notify = undefined;
        await n.save();
      }
      const examinees = await Examinee.find({ notify: true });
      for (let i = 0; i < examinees.length; i++) {
        const user = examinees[i];
        user.notify = undefined;
        await user.save();
      }
    });
  } catch (error) {
    return res.sse({
      data: 'Events error',
      event: 'ERROR',
    });
  }
};

const account_name = async (req: Request, res: Response) => {
  if (req.token === undefined) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    const admin = await Admin.findById(req.token.id);
    if (admin === null) {
      return res.status(400).json({ error: 'User not found' });
    }
    const encname = Encrypt(req.body.name);
    admin.name = Buffer.concat([encname[2], encname[0], encname[1]]);
    await admin.save();
    return res
      .status(200)
      .json({ message: 'Name edited successfully', name: req.body.name });
  } catch (error) {
    return res.status(400).json({ error: 'Unable to edit name' });
  }
};

const account_getcomm = async (req: Request, res: Response) => {
  if (req.token === undefined) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    const admin = await Admin.findById(req.token.id);
    if (admin === null) {
      return res.status(400).json({ error: 'User not found' });
    }
    return res.status(200).json({
      commid: Decrypt(
        admin.comid.subarray(0, 32),
        admin.comid.subarray(admin.comid.length - 16),
        admin.comid.subarray(32, admin.comid.length - 16)
      ).toString(),
    });
  } catch (error) {
    return res.status(400).json({ error: 'Unable to get commid' });
  }
};

const account_commid = async (req: Request, res: Response) => {
  if (req.token === undefined) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    const admin = await Admin.findById(req.token.id);
    if (admin === null) {
      return res.status(400).json({ error: 'User not found' });
    }
    const enccommid = Encrypt(req.body.commid);
    admin.change = {
      commid: Buffer.concat([enccommid[2], enccommid[0], enccommid[1]]),
    };
    const code = randomBytes(256).toString('base64url');
    const dd = new Date();
    admin.verification = await hash(code, 10);
    admin.DeleteAccountChangeAfter = new Date(dd.getTime() + 60 * 60000);
    await admin.save();
    await sendcom(
      Decrypt(
        admin.comid.subarray(0, 32),
        admin.comid.subarray(admin.comid.length - 16),
        admin.comid.subarray(32, admin.comid.length - 16)
      ).toString(),
      'Changing communication Id',
      {
        logo: `${process.env.serverurl}public/logo/`,
        name: Decrypt(
          admin.name.subarray(0, 32),
          admin.name.subarray(admin.name.length - 16),
          admin.name.subarray(32, admin.name.length - 16)
        ).toString(),
        requestlink: `${process.env.client}#/verification/${code}/${admin._id}`,
        securelink: `${process.env.client}#/secure/${code}/${admin._id}`,
      },
      'CCOMM'
    );
    return res.status(200).json({
      message: 'Please verify request from your previous communication id',
    });
  } catch (error) {
    return res.status(400).json({ error: 'Unable to edit communication Id' });
  }
};

const account_password = async (req: Request, res: Response) => {
  if (req.token === undefined) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    const admin = await Admin.findById(req.token.id);
    if (admin === null) {
      return res.status(400).json({ error: 'User not found' });
    }
    const tmpcom = await compare(req.body.currentpassword, admin.password);
    if (tmpcom && req.body.currentpassword !== req.body.newpassword) {
      const encpassword = await hash(req.body.newpassword, 13);
      admin.change = {
        password: encpassword,
      };
      const code = randomBytes(256).toString('base64url');
      const dd = new Date();
      admin.verification = await hash(code, 10);
      admin.DeleteAccountChangeAfter = new Date(dd.getTime() + 60 * 60000);
      await admin.save();
      await sendcom(
        Decrypt(
          admin.comid.subarray(0, 32),
          admin.comid.subarray(admin.comid.length - 16),
          admin.comid.subarray(32, admin.comid.length - 16)
        ).toString(),
        'Changing password',
        {
          logo: `${process.env.serverurl}public/logo/`,
          name: Decrypt(
            admin.name.subarray(0, 32),
            admin.name.subarray(admin.name.length - 16),
            admin.name.subarray(32, admin.name.length - 16)
          ).toString(),
          requestlink: `${process.env.client}#/verification/${code}/${admin._id}`,
          securelink: `${process.env.client}#/secure/${code}/${admin._id}`,
        },
        'CHANGEPASSWORD'
      );
      return res.status(200).json({
        message: 'Please verify your request for changing password',
      });
    } else {
      return res.status(400).json({ error: 'Unable to edit password' });
    }
  } catch (error) {
    return res.status(400).json({ error: 'Unable to edit password' });
  }
};

export {
  notification,
  notification_details,
  mark_notification,
  unmark_notification,
  delete_notification,
  examinees,
  examinees_details,
  examinee_images,
  verify_examinee,
  disprove_examinee,
  delete_examinee,
  moderators,
  moderators_details,
  moderator_images,
  verify_moderator,
  disprove_moderator,
  delete_moderator,
  admin_event,
  account_name,
  account_getcomm,
  account_commid,
  account_password,
};
