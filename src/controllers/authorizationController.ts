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
import { compare } from 'bcryptjs';
import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { SignJWT, importJWK, decodeJwt } from 'jose';
import {
  createHash,
  createDecipheriv,
  createSecretKey,
  randomBytes,
} from 'crypto';

import { Examinee, Admin, Moderator } from '../database/schema/userSchema';
import { Notification } from '../database/schema/notificationSchema';
import { check } from '../helpers/checkTokens';
import { generateTokens } from '../helpers/generateTokenKeys';
import { Decrypt } from '../helpers/encrypt_decrypt';

const base64URLEncode = (str: Buffer) => {
  return str
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
};

const authorize = async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    let user = await Admin.findById(req.params.userid);
    if (user !== null && user.type === 'MODERATOR') {
      user = await Moderator.findById(req.params.userid);
    } else if (user !== null && user.type === 'EXAMINEE') {
      user = await Examinee.findById(req.params.userid);
    }

    if (user === null) {
      return res.status(400).json({ error: 'This user does not exists' });
    }

    if (user.verified) {
      user.oauth = {
        challenge: req.params.code_challenge,
        code: '',
      };
      await user.save();
      return res.status(302).json({ state: req.params.state });
    } else {
      return res.status(400).json({ error: 'User is not verified' });
    }
  } catch (error) {
    return res.status(400).json({ error: 'Signin failed' });
  }
};

const token = async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    const id = req.params.userid;
    const code_verifier = req.params.code_verifier;
    const secret_code = req.params.secret_code;

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
    const user_code_challenge = base64URLEncode(
      createHash('sha256').update(code_verifier).digest()
    );
    if (user.oauth.challenge === user_code_challenge) {
      if (!(await compare(secret_code, user.oauth.code))) {
        user.oauth = undefined;
        await user.save();
        return res.status(400).json({ error: 'Signin failed' });
      }
      user.oauth = undefined;
      user.Isloggedin = true;
      const tid = randomBytes(256).toString('base64');
      const dd = new Date();
      user.tid = tid;
      user.LogoutUserAfter = new Date(dd.getTime() + 20 * 60000);
      await user.save();
      const decipher = createDecipheriv(
        'aes-256-gcm',
        createSecretKey(
          Buffer.from(
            JSON.parse(
              process.env.key === undefined ? process.exit(1) : process.env.key
            ).k,
            'base64'
          )
        ).export(),
        user.oauthppk.subarray(0, 32)
      );
      decipher.setAuthTag(user.oauthppk.subarray(user.oauthppk.length - 16));
      let decipheration = Buffer.concat([
        decipher.update(user.oauthppk.subarray(32, user.oauthppk.length - 16)),
        decipher.final(),
      ]);
      const RefreshToken = await new SignJWT({
        userId: user._id,
        tid: tid,
      })
        .setProtectedHeader({ alg: 'EdDSA' })
        .setAudience(user.type)
        .setNotBefore(new Date().getTime() / 1000 + 294)
        .setIssuedAt()
        .setIssuer(process.env.issuer === undefined ? '' : process.env.issuer)
        .setSubject(user._id)
        .setExpirationTime(new Date().getTime() / 1000 + 1200)
        .sign(
          await importJWK(
            JSON.parse(
              JSON.parse(decipheration.toString()).Refresh_Private_Key
            ),
            'EdDSA'
          )
        );
      const AccessToken = await new SignJWT({
        userType: user.type,
        userId: user._id,
      })
        .setProtectedHeader({ alg: 'EdDSA' })
        .setAudience(user.type)
        .setIssuedAt()
        .setIssuer(process.env.issuer === undefined ? '' : process.env.issuer)
        .setSubject(user._id)
        .setExpirationTime(new Date().getTime() / 1000 + 300)
        .sign(
          await importJWK(
            JSON.parse(JSON.parse(decipheration.toString()).Access_Private_Key),
            'EdDSA'
          )
        );
      decipheration = Buffer.from('');
      return res.status(200).json({
        state: req.params.state,
        refreshtoken: RefreshToken,
        accesstoken: AccessToken,
        user: user.type,
        msg: 'Signin successful',
        name: Decrypt(
          user.name.subarray(0, 32),
          user.name.subarray(user.name.length - 16),
          user.name.subarray(32, user.name.length - 16)
        ).toString(),
      });
    } else {
      user.oauth = undefined;
      await user.save();
      return res.status(400).json({ error: 'Signin failed' });
    }
  } catch (error) {
    const user = await Admin.findById(req.params.userid);
    if (user !== null) {
      user.oauth = undefined;
      user.Isloggedin = false;
      user.tid = undefined;
      user.LogoutUserAfter = undefined;
      await user.save();
    }
    return res.status(400).json({ error: 'Signin failed' });
  }
};

const refreshToken = async (req: Request, res: Response) => {
  const refreshToken = req.get('Authorization');
  if (refreshToken === undefined) {
    return res.status(400).json({ error: 'Malformed request' });
  }
  try {
    const decodedToken = decodeJwt(refreshToken.split(' ')[1]);
    let user = await Admin.findById(decodedToken.userId);
    if (user !== null && user.type === 'MODERATOR') {
      user = await Moderator.findById(decodedToken.userId);
    } else if (user !== null && user.type === 'EXAMINEE') {
      user = await Examinee.findById(decodedToken.userId);
    }
    if (user === null) {
      return res.status(401).json({ error: 'Failed to obtain refresh token' });
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
      return res.status(401).json({ error: 'Failed to obtain refresh token' });
    }
    if ((await check(user, refreshToken.split(' ')[1], 'Refresh')) === false) {
      return res.status(401).json({ error: 'Failed to verify token' });
    }
    if (user.tid === undefined) {
      return res.status(401).json({ error: 'Failed to obtain refresh token' });
    }
    if (user.tid === decodedToken.tid) {
      const tid = randomBytes(256).toString('base64');
      const dd = new Date();
      user.tid = tid;
      user.LogoutUserAfter = new Date(dd.getTime() + 20 * 60000);
      await user.save();
      const decipher = createDecipheriv(
        'aes-256-gcm',
        createSecretKey(
          Buffer.from(
            JSON.parse(
              process.env.key === undefined ? process.exit(1) : process.env.key
            ).k,
            'base64'
          )
        ).export(),
        user.oauthppk.subarray(0, 32)
      );
      decipher.setAuthTag(user.oauthppk.subarray(user.oauthppk.length - 16));
      let decipheration = Buffer.concat([
        decipher.update(user.oauthppk.subarray(32, user.oauthppk.length - 16)),
        decipher.final(),
      ]);
      const RefreshToken = await new SignJWT({
        userId: user._id,
        tid: tid,
      })
        .setProtectedHeader({ alg: 'EdDSA' })
        .setAudience(user.type)
        .setNotBefore(new Date().getTime() / 1000 + 294)
        .setIssuedAt()
        .setIssuer(process.env.issuer === undefined ? '' : process.env.issuer)
        .setSubject(user._id)
        .setExpirationTime(new Date().getTime() / 1000 + 1200)
        .sign(
          await importJWK(
            JSON.parse(
              JSON.parse(decipheration.toString()).Refresh_Private_Key
            ),
            'EdDSA'
          )
        );
      const AccessToken = await new SignJWT({
        userType: user.type,
        userId: user._id,
      })
        .setProtectedHeader({ alg: 'EdDSA' })
        .setAudience(user.type)
        .setIssuedAt()
        .setIssuer(process.env.issuer === undefined ? '' : process.env.issuer)
        .setSubject(user._id)
        .setExpirationTime(new Date().getTime() / 1000 + 300)
        .sign(
          await importJWK(
            JSON.parse(JSON.parse(decipheration.toString()).Access_Private_Key),
            'EdDSA'
          )
        );
      decipheration = Buffer.from('');
      return res.status(200).json({
        refreshtoken: RefreshToken,
        accesstoken: AccessToken,
      });
    } else {
      const array = generateTokens();
      user.oauthppk = Buffer.concat([array[2], array[0], array[1]]);
      user.Isloggedin = false;
      user.tid = undefined;
      user.LogoutUserAfter = undefined;
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
        detail: `One of the user ${user._id} was compromised. Necessary actions has been taken to secure the users account. Please review all the security details of your system`,
      });
      return res.status(401).json({ error: 'Failed to obtain refresh token' });
    }
  } catch (error) {
    return res.status(401).json({ error: 'Failed to obtain refresh token' });
  }
};

export { authorize, token, refreshToken };
