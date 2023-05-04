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
import { Schema, model, Types } from 'mongoose';

import { paperInterface } from '../interface';

const paperSchema = new Schema({
  UserId: {
    type: Types.ObjectId,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  examineelist: {
    type: Array<Types.ObjectId>,
    required: true,
  },
  testtime: {
    type: Array<number>,
    required: true,
  },
  windowstart: {
    type: Date,
    required: true,
  },
  windowend: {
    type: Date,
    required: true,
  },
  paper: {
    type: Buffer,
    required: true,
  },
  mode: {
    type: String,
    required: true,
  },
  key: {
    type: Buffer,
    required: true,
  },
  notverifiedexamineelist: {
    type: Array<{
      mid?: Types.ObjectId;
      id: Types.ObjectId;
      time: Array<number>;
      isverified: boolean;
    }>,
    default: [],
  },
  activeexamineelist: {
    type: Array<{
      mid?: Types.ObjectId;
      id: Types.ObjectId;
      time: Array<number>;
      isverified: boolean;
    }>,
    default: [],
  },
  inactiveexamineelist: {
    type: Array<{
      mid?: Types.ObjectId;
      id: Types.ObjectId;
      time: Array<number>;
      isverified: boolean;
    }>,
    default: [],
  },
  starttest: {
    type: Boolean,
  },
  StartTestOn: {
    type: Date,
    default: undefined,
    index: true,
  },
  EndTestOn: {
    type: Date,
    default: undefined,
    index: true,
  },
  endtest: {
    type: Boolean,
  },
});

const Test = model<paperInterface>('Test', paperSchema, 'Tests');

export { Test };
