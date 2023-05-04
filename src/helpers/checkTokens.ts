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
import { createDecipheriv, createSecretKey } from 'crypto';
import { jwtVerify, importJWK, JWTVerifyResult } from 'jose';

import {
  adminInterface,
  examineeInterface,
  moderatorInterface,
} from '../database/interface';

const check = async (
  user: adminInterface | moderatorInterface | examineeInterface,
  authToken: string,
  type: 'Access' | 'Refresh'
) => {
  try {
    let id: string;
    if (typeof user._id === 'object') {
      id = user._id.toString();
    } else if (typeof user._id === 'string') {
      id = user._id;
    } else {
      throw new Error('ID is not correct');
    }
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
    ).setAuthTag(user.oauthppk.subarray(user.oauthppk.length - 16));
    let decipheration = Buffer.concat([
      decipher.update(user.oauthppk.subarray(32, user.oauthppk.length - 16)),
      decipher.final(),
    ]);
    let vobject: JWTVerifyResult;
    if (type === 'Access') {
      vobject = await jwtVerify(
        authToken,
        await importJWK(
          JSON.parse(JSON.parse(decipheration.toString()).Access_Public_Key),
          'EdDSA'
        ),
        {
          issuer: process.env.issuer,
          audience: user.type,
          subject: id,
          algorithms: ['EdDSA'],
        }
      );
    } else if (type === 'Refresh') {
      vobject = await jwtVerify(
        authToken,
        await importJWK(
          JSON.parse(JSON.parse(decipheration.toString()).Refresh_Public_Key),
          'EdDSA'
        ),
        {
          issuer: process.env.issuer,
          audience: user.type,
          subject: id,
          algorithms: ['EdDSA'],
        }
      );
    } else {
      throw new Error('incorrect type');
    }
    decipheration = Buffer.from('');
    return vobject.payload;
  } catch (error) {
    return false;
  }
};

export { check };
