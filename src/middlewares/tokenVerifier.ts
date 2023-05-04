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
import { decodeJwt } from 'jose';
import { Response, Request, NextFunction } from 'express';

import { Admin, Moderator, Examinee } from '../database/schema/userSchema';
import { Notification } from '../database/schema/notificationSchema';
import {
  adminInterface,
  moderatorInterface,
  examineeInterface,
} from '../database/interface';
import { generateTokens } from '../helpers/generateTokenKeys';
import { check } from '../helpers/checkTokens';

const tokenCheck = async (req: Request, res: Response, next: NextFunction) => {
  let tokenHeader: string | undefined;
  if (
    req.url.split('/')[1] === 'admin-event' ||
    req.url.split('/')[1] === 'moderator-event' ||
    req.url.split('/')[1] === 'examinee-event'
  ) {
    tokenHeader = req.params.token;
  } else {
    tokenHeader = req.get('Authorization');
  }
  if (tokenHeader === undefined) {
    if (
      req.url.split('/')[1] === 'admin-event' ||
      req.url.split('/')[1] === 'moderator-event' ||
      req.url.split('/')[1] === 'examinee-event'
    )
      return res.sse({
        data: 'Failed to verify token',
        event: 'ERROR',
      });
    return res.status(401).json({ error: 'Failed to verify token' });
  }
  try {
    const decodedToken = decodeJwt(tokenHeader.split(' ')[1]);
    let user: adminInterface | moderatorInterface | examineeInterface | null;
    if (decodedToken.userType === 'MODERATOR') {
      user = await Moderator.findById(decodedToken.userId);
    } else if (decodedToken.userType === 'ADMIN') {
      user = await Admin.findById(decodedToken.userId);
    } else if (decodedToken.userType === 'EXAMINEE') {
      user = await Examinee.findById(decodedToken.userId);
    } else {
      if (
        req.url.split('/')[1] === 'admin-event' ||
        req.url.split('/')[1] === 'moderator-event' ||
        req.url.split('/')[1] === 'examinee-event'
      )
        return res.sse({
          data: 'Failed to verify token',
          event: 'ERROR',
        });
      return res.status(401).json({ error: 'Failed to verify token' });
    }
    if (user === null) {
      if (
        req.url.split('/')[1] === 'admin-event' ||
        req.url.split('/')[1] === 'moderator-event' ||
        req.url.split('/')[1] === 'examinee-event'
      )
        return res.sse({
          data: 'Failed to verify token',
          event: 'ERROR',
        });
      return res.status(401).json({ error: 'Failed to verify token' });
    }
    const payload = await check(user, tokenHeader.split(' ')[1], 'Access');
    if (payload === false) {
      if (
        req.url.split('/')[1] === 'admin-event' ||
        req.url.split('/')[1] === 'moderator-event' ||
        req.url.split('/')[1] === 'examinee-event'
      )
        return res.sse({
          data: 'Failed to verify token',
          event: 'ERROR',
        });
      return res.status(401).json({ error: 'Failed to verify token' });
    }
    if (user.Isloggedin === false) {
      const array = generateTokens();
      user.oauthppk = Buffer.concat([array[2], array[0], array[1]]);
      await user.save();
      const admin = await Admin.findOne({ type: 'ADMIN' });
      if (admin === null) {
        process.exit(1);
      }
      await Notification.create({
        UserId: admin._id,
        type: 'Issue',
        Date: new Date(),
        severity: 'Critical',
        mark: false,
        title: 'Security Breach',
        notify: admin.Isloggedin === true ? true : undefined,
        detail: `One of the user ${user._id} was compromised. Necessary actions has been taken to secure the user's account. Please review all the security details of your system`,
      });
      if (
        req.url.split('/')[1] === 'admin-event' ||
        req.url.split('/')[1] === 'moderator-event' ||
        req.url.split('/')[1] === 'examinee-event'
      )
        return res.sse({
          data: 'Failed to verify token',
          event: 'ERROR',
        });
      return res.status(401).json({ error: 'Failed to verify token' });
    }
    if (typeof payload.userId !== 'string') {
      throw new Error('userId is not string');
    }
    if (typeof payload.userType !== 'string') {
      throw new Error('userType is not string');
    }
    if (req.baseUrl.split('/')[2] === payload.userType.toLowerCase()) {
      req.token = { id: payload.userId, type: payload.userType };
      if (
        req.url.split('/')[1] === 'admin-event' ||
        req.url.split('/')[1] === 'moderator-event' ||
        req.url.split('/')[1] === 'examinee-event'
      ) {
        return;
      }
      next();
    } else {
      if (
        req.url.split('/')[1] === 'admin-event' ||
        req.url.split('/')[1] === 'moderator-event' ||
        req.url.split('/')[1] === 'examinee-event'
      )
        return res.sse({
          data: 'Failed to verify token',
          event: 'ERROR',
        });
      return res.status(401).json({ error: 'Failed to verify token' });
    }
  } catch (error) {
    if (
      req.url.split('/')[1] === 'admin-event' ||
      req.url.split('/')[1] === 'moderator-event' ||
      req.url.split('/')[1] === 'examinee-event'
    )
      return res.sse({
        data: 'Failed to verify token',
        event: 'ERROR',
      });
    return res.status(401).json({ error: 'Failed to verify token' });
  }
};

export { tokenCheck };
