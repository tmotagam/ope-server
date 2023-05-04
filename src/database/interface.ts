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
import { Document, Types } from 'mongoose';

interface PKCE {
  challenge: string;
  code: string;
}

interface TR {
  reviewReason: string;
  reviewType: string;
}

interface notificationInterface extends Document {
  Date: Date;
  UserId: Types.ObjectId;
  type: 'Issue' | 'Notification';
  severity?: 'Critical' | 'Warning';
  mark: boolean;
  title: string;
  detail: string;
  notify?: boolean;
}

interface paperInterface extends Document {
  UserId: Types.ObjectId;
  name: string;
  date: Date;
  mode: string;
  examineelist: Array<Types.ObjectId>;
  testtime: Array<number>;
  windowstart: Date;
  windowend: Date;
  starttest?: boolean;
  notverifiedexamineelist: Array<{
    mid?: Types.ObjectId;
    id: Types.ObjectId;
    time: Array<number>;
    isverified: boolean;
  }>;
  activeexamineelist: Array<{
    mid?: Types.ObjectId;
    id: Types.ObjectId;
    time: Array<number>;
    isverified: boolean;
  }>;
  inactiveexamineelist: Array<{
    mid?: Types.ObjectId;
    id: Types.ObjectId;
    time: Array<number>;
    isverified: boolean;
  }>;
  paper: Buffer;
  key: Buffer;
  StartTestOn?: Date;
  EndTestOn?: Date;
  endtest?: boolean;
}

interface accountchanges {
  commid?: Buffer;
  password?: string;
}

interface adminInterface extends Document {
  comid: Buffer;
  type: string;
  verified: boolean;
  name: Buffer;
  Isloggedin: boolean;
  verification?: string;
  tid?: string;
  oauth?: PKCE;
  oauthppk: Buffer;
  password: string;
  change: accountchanges;
  LogoutUserAfter?: Date;
  DeleteAccountChangeAfter?: Date;
  DeleteNVUserAfter?: Date;
  deletePasswordrequestAfter?: Date;
}

interface moderatorInterface extends Document {
  comid: Buffer;
  type: string;
  verified: boolean;
  status: 'Not Verified' | 'Pending Verification' | 'Verified' | 'InReview';
  name: Buffer;
  Isloggedin: boolean;
  verification?: string;
  tid?: string;
  oauth?: PKCE;
  oauthppk: Buffer;
  password: string;
  review?: TR;
  image: { name: string; id: string }[];
  notify?: boolean;
  change: accountchanges;
  LogoutUserAfter?: Date;
  DeleteAccountChangeAfter?: Date;
  DeleteNVUserAfter?: Date;
  deletePasswordrequestAfter?: Date;
}

interface examineeInterface extends Document {
  comid: Buffer;
  type: string;
  verified: boolean;
  status: 'Not Verified' | 'Pending Verification' | 'Verified' | 'InReview';
  name: Buffer;
  Isloggedin: boolean;
  verification?: string;
  tid?: string;
  oauth?: PKCE;
  oauthppk: Buffer;
  password: string;
  review?: TR;
  image: { name: string; id: string }[];
  notify?: boolean;
  change?: accountchanges;
  testcode?: { tid: string; tcode: string };
  LogoutUserAfter?: Date;
  DeleteAccountChangeAfter?: Date;
  DeleteNVUserAfter?: Date;
  deletePasswordrequestAfter?: Date;
}

interface evaluationInterface extends Document {
  userid: Types.ObjectId;
  testid: Types.ObjectId;
  mode: string;
  verificationimages?: Array<{ name: string; id: string }>;
  testvideos?: Array<{ name: string; id: string }>;
  answersheet: Buffer;
  key: Buffer;
  cheated?: Array<{
    userid: Types.ObjectId;
    is: boolean;
    reason: string;
    timestamp: string;
  }>;
  evaluator: Types.ObjectId;
  evaluated: boolean;
  isended: boolean;
}

export {
  adminInterface,
  moderatorInterface,
  examineeInterface,
  paperInterface,
  notificationInterface,
  evaluationInterface,
};
