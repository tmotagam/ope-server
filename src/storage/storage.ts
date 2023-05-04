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
import { google, drive_v3 } from 'googleapis';
import { Readable } from 'stream';

let Drive: drive_v3.Drive;

const Init = () => {
  if (process.env.GKey === undefined) {
    process.exit(1);
  }
  const Gkey = JSON.parse(process.env.GKey);

  const Auth = new google.auth.JWT(
    Gkey.client_email,
    undefined,
    Gkey.private_key,
    ['https://www.googleapis.com/auth/drive']
  );
  Drive = new drive_v3.Drive({
    auth: Auth,
  });
};

const internal_Buffer_Stream = (buf: Buffer) => {
  const stream = new Readable();
  stream.push(buf);
  stream.push(null);

  return stream;
};

const Get = async (name: string) => {
  const promise = await new Promise<Buffer>((resolve, reject) => {
    Drive.files.list(
      {
        q: `name = '${name}'`,
      },
      (err, res) => {
        if (err) return reject(err);
        if (res === undefined || res === null) {
          return reject(undefined);
        }
        if (res.data.files === undefined) {
          return reject(undefined);
        }
        if (res.data.files[0].id === null) {
          return reject(undefined);
        }
        Drive.files.get(
          { fileId: res.data.files[0].id, alt: 'media' },
          { responseType: 'stream' },
          (err, res) => {
            if (err) {
              return reject(err);
            }
            const buf: Array<Buffer> = [];
            res?.data.on('data', (e) => buf.push(e));
            res?.data.on('end', () => {
              const buffer = Buffer.concat(buf);
              return resolve(buffer);
            });
          }
        );
      }
    );
  }).catch((err) => {
    throw err;
  });
  return promise;
};

const Update = async (
  data: Buffer,
  id: string,
  mimeType: string,
  name: string
) => {
  try {
    await Delete(id);
    return await New(data, mimeType, name);
  } catch (error) {
    throw error;
  }
};

const Delete = async (id: string) => {
  const promise = await new Promise<string>((resolve, reject) => {
    Drive.files.delete(
      {
        fileId: id,
      },
      (err) => {
        if (err) return reject(err);
        return resolve('File deleted successfully');
      }
    );
  }).catch((err) => {
    throw err;
  });
  return promise;
};

const New = async (data: Buffer, mimeType: string, name: string) => {
  const promise = await new Promise<string>((resolve, reject) => {
    Drive.files.create(
      {
        requestBody: {
          name: `${name}.${mimeType}`,
        },
        media: {
          body: internal_Buffer_Stream(data),
        },
      },
      (err, res) => {
        if (err) return reject(err);
        return resolve(typeof res?.data.id === 'string' ? res?.data.id : '');
      }
    );
  }).catch((err) => {
    throw err;
  });
  return promise;
};

export { Init, New, Get, Update, Delete };
