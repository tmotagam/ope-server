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
  generateKeyPairSync,
  randomBytes,
  createSecretKey,
  createCipheriv,
} from 'crypto';

const generateTokens = (): Buffer[] => {
  const rkey = generateKeyPairSync('ed448');
  const akey = generateKeyPairSync('ed448');

  const iv = randomBytes(32);
  const cipher = createCipheriv(
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
  return [
    Buffer.concat([
      cipher.update(
        Buffer.from(
          JSON.stringify({
            Access_Private_Key: JSON.stringify(
              akey.privateKey.export({ format: 'jwk' })
            ),
            Access_Public_Key: JSON.stringify(
              akey.publicKey.export({ format: 'jwk' })
            ),
            Refresh_Private_Key: JSON.stringify(
              rkey.privateKey.export({ format: 'jwk' })
            ),
            Refresh_Public_Key: JSON.stringify(
              rkey.publicKey.export({ format: 'jwk' })
            ),
          })
        )
      ),
      cipher.final(),
    ]),
    cipher.getAuthTag(),
    iv,
  ];
};

export { generateTokens };
