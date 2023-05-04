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
import {
  randomBytes,
  createSecretKey,
  createCipheriv,
  createDecipheriv,
  CipherGCM,
  DecipherGCM,
} from 'crypto';

const Encrypt = (data: string | Buffer, key?: Buffer): Buffer[] => {
  let cipher: CipherGCM;
  const iv = randomBytes(32);
  if (key !== undefined) {
    cipher = createCipheriv('aes-256-gcm', key, iv);
  } else {
    cipher = createCipheriv(
      'aes-256-gcm',
      createSecretKey(
        Buffer.from(
          JSON.parse(
            process.env.key === undefined ? process.exit(1) : process.env.key
          ).k,
          'base64'
        )
      ).export(),
      iv
    );
  }
  return [
    Buffer.concat([
      cipher.update(typeof data === 'string' ? Buffer.from(data) : data),
      cipher.final(),
    ]),
    cipher.getAuthTag(),
    iv,
  ];
};

const Decrypt = (
  iv: Buffer,
  authTag: Buffer,
  data: Buffer,
  key?: Buffer
): Buffer => {
  let decipher: DecipherGCM;
  if (key !== undefined) {
    decipher = createDecipheriv('aes-256-gcm', key, iv).setAuthTag(authTag);
  } else {
    decipher = createDecipheriv(
      'aes-256-gcm',
      createSecretKey(
        Buffer.from(
          JSON.parse(
            process.env.key === undefined ? process.exit(1) : process.env.key
          ).k,
          'base64'
        )
      ).export(),
      iv
    ).setAuthTag(authTag);
  }
  return Buffer.concat([decipher.update(data), decipher.final()]);
};

export { Encrypt, Decrypt };
