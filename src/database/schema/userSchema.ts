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
import { Schema, model } from 'mongoose';

import {
  adminInterface,
  moderatorInterface,
  examineeInterface,
} from '../interface';

const imageType = [
  {
    _id: false,
    name: String,
    id: String,
  },
];

const accountchanges = {
  _id: false,
  commid: Buffer,
  password: String,
};

const PKCE = {
  _id: false,
  challenge: String,
  code: String,
};

const TR = {
  _id: false,
  reviewReason: String,
  reviewType: String,
};

const adminSchema = new Schema({
  comid: {
    type: Buffer,
    required: true,
  },
  type: {
    type: String,
    required: true,
  },
  verified: {
    type: Boolean,
    default: false,
  },
  verification: {
    type: String,
    default: undefined,
  },
  Isloggedin: {
    type: Boolean,
    default: false,
  },
  tid: {
    type: String,
    default: undefined,
  },
  oauth: {
    type: PKCE,
  },
  oauthppk: {
    type: Buffer,
    default: Buffer.from(''),
  },
  name: {
    type: Buffer,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  change: {
    type: accountchanges,
  },
  LogoutUserAfter: {
    type: Date,
    default: undefined,
    index: true,
  },
  DeleteAccountChangeAfter: {
    type: Date,
    default: undefined,
    index: true,
  },
  DeleteNVUserAfter: {
    type: Date,
    default: undefined,
    index: true,
  },
  deletePasswordrequestAfter: {
    type: Date,
    default: undefined,
    index: true,
  },
});

const moderatorSchema = new Schema({
  comid: {
    type: Buffer,
    required: true,
  },
  type: {
    type: String,
    required: true,
  },
  verified: {
    type: Boolean,
    default: false,
  },
  status: {
    type: String,
    required: true,
    enum: ['Not Verified', 'Pending Verification', 'Verified', 'InReview'],
  },
  verification: {
    type: String,
    default: undefined,
  },
  Isloggedin: {
    type: Boolean,
    default: false,
  },
  tid: {
    type: String,
    default: undefined,
  },
  oauth: {
    type: PKCE,
  },
  oauthppk: {
    type: Buffer,
    default: Buffer.from(''),
  },
  name: {
    type: Buffer,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  review: {
    type: TR,
  },
  image: {
    type: imageType,
    default: [],
  },
  notify: {
    type: Boolean,
  },
  change: {
    type: accountchanges,
  },
  LogoutUserAfter: {
    type: Date,
    default: undefined,
    index: true,
  },
  DeleteAccountChangeAfter: {
    type: Date,
    default: undefined,
    index: true,
  },
  DeleteNVUserAfter: {
    type: Date,
    default: undefined,
    index: true,
  },
  deletePasswordrequestAfter: {
    type: Date,
    default: undefined,
    index: true,
  },
});

const examineeSchema = new Schema({
  comid: {
    type: Buffer,
    required: true,
  },
  type: {
    type: String,
    required: true,
  },
  verified: {
    type: Boolean,
    default: false,
  },
  status: {
    type: String,
    required: true,
    enum: ['Not Verified', 'Pending Verification', 'Verified', 'InReview'],
  },
  verification: {
    type: String,
    default: undefined,
  },
  Isloggedin: {
    type: Boolean,
    default: false,
  },
  tid: {
    type: String,
    default: undefined,
  },
  oauth: {
    type: PKCE,
  },
  oauthppk: {
    type: Buffer,
    default: Buffer.from(''),
  },
  name: {
    type: Buffer,
    required: true,
  },
  password: {
    type: String,
    default: '',
  },
  review: {
    type: TR,
  },
  image: {
    type: imageType,
    default: [],
  },
  notify: {
    type: Boolean,
  },
  change: {
    type: accountchanges,
  },
  testcode: {
    type: { _id: false, tid: String, tcode: String },
  },
  LogoutUserAfter: {
    type: Date,
    default: undefined,
    index: true,
  },
  DeleteAccountChangeAfter: {
    type: Date,
    default: undefined,
    index: true,
  },
  DeleteNVUserAfter: {
    type: Date,
    default: undefined,
    index: true,
  },
  deletePasswordrequestAfter: {
    type: Date,
    default: undefined,
    index: true,
  },
});

const Admin = model<adminInterface>('Admin', adminSchema, 'Users');

const Moderator = model<moderatorInterface>(
  'Moderator',
  moderatorSchema,
  'Users'
);

const Examinee = model<examineeInterface>('Examinee', examineeSchema, 'Users');

export { Admin, Moderator, Examinee };
