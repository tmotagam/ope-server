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
  TransactionalEmailsApi,
  TransactionalEmailsApiApiKeys,
} from '@sendinblue/client';
import { join } from 'path';
import { readFileSync } from 'fs';
import { compile } from 'handlebars';

let mail: TransactionalEmailsApi;

const cominit = () => {
  mail = new TransactionalEmailsApi();
  if (typeof process.env.commkey === 'string') {
    mail.setApiKey(TransactionalEmailsApiApiKeys.apiKey, process.env.commkey);
    return true;
  } else {
    throw new Error('Api key not defined');
  }
};

const sendcom = async (
  to: string,
  subject: string,
  data: object,
  type:
    | 'EVCODE'
    | 'TESTSELECT'
    | 'TESTSTART'
    | 'CCOMM'
    | 'APPROVE'
    | 'REJECT'
    | 'UVCODE'
    | 'RESETPASSWORD'
    | 'CHANGEPASSWORD'
    | 'RESULT'
) => {
  let parsedData: string;
  if (typeof process.env.commid !== 'string') {
    throw new Error('Communication id is not defined');
  }
  if (type === 'EVCODE') {
    const Path = join(
      __dirname,
      '..',
      'templates',
      'emailverification.handlebars'
    );
    const template = readFileSync(Path, {
      encoding: 'utf8',
    });
    const html = compile(template);
    parsedData = html(data);
  } else if (type === 'UVCODE') {
    const Path = join(
      __dirname,
      '..',
      'templates',
      'userverification.handlebars'
    );
    const template = readFileSync(Path, {
      encoding: 'utf8',
    });
    const html = compile(template);
    parsedData = html(data);
  } else if (type === 'APPROVE') {
    const Path = join(
      __dirname,
      '..',
      'templates',
      'accountapproved.handlebars'
    );
    const template = readFileSync(Path, { encoding: 'utf-8' });
    const html = compile(template);
    parsedData = html(data);
  } else if (type === 'REJECT') {
    const Path = join(
      __dirname,
      '..',
      'templates',
      'accountdisproved.handlebars'
    );
    const template = readFileSync(Path, { encoding: 'utf-8' });
    const html = compile(template);
    parsedData = html(data);
  } else if (type === 'CCOMM') {
    const Path = join(__dirname, '..', 'templates', 'changecommid.handlebars');
    const template = readFileSync(Path, { encoding: 'utf-8' });
    const html = compile(template);
    parsedData = html(data);
  } else if (type === 'CHANGEPASSWORD') {
    const Path = join(
      __dirname,
      '..',
      'templates',
      'changepassword.handlebars'
    );
    const template = readFileSync(Path, { encoding: 'utf-8' });
    const html = compile(template);
    parsedData = html(data);
  } else if (type === 'TESTSELECT') {
    const Path = join(__dirname, '..', 'templates', 'testselection.handlebars');
    const template = readFileSync(Path, {
      encoding: 'utf8',
    });
    const html = compile(template);
    parsedData = html(data);
  } else if (type === 'TESTSTART') {
    const Path = join(__dirname, '..', 'templates', 'teststart.handlebars');
    const template = readFileSync(Path, {
      encoding: 'utf8',
    });
    const html = compile(template);
    parsedData = html(data);
  } else if (type === 'RESETPASSWORD') {
    const Path = join(__dirname, '..', 'templates', 'resetpassword.handlebars');
    const template = readFileSync(Path, {
      encoding: 'utf8',
    });
    const html = compile(template);
    parsedData = html(data);
  } else if (type === 'RESULT') {
    const Path = join(
      __dirname,
      '..',
      'templates',
      'evaluationcompleted.handlebars'
    );
    const template = readFileSync(Path, {
      encoding: 'utf8',
    });
    const html = compile(template);
    parsedData = html(data);
  } else {
    return false;
  }
  const msg = {
    to: [{ name: 'Client', email: to }],
    sender: { name: 'OPE Server', email: process.env.commid },
    subject: subject,
    htmlContent: parsedData,
  };
  try {
    await mail.sendTransacEmail(msg);
    return true;
  } catch (error) {
    return false;
  }
};

export { cominit, sendcom };
