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

import { evaluationInterface } from '../interface';

const evaluationSchema = new Schema({
  userid: {
    type: Types.ObjectId,
    required: true,
  },
  testid: {
    type: Types.ObjectId,
    required: true,
  },
  mode: {
    type: String,
    required: true,
  },
  verificationimages: {
    type: Array<{ _id: false; name: string; id: string }>,
    default: undefined,
  },
  testvideos: {
    type: Array<{ _id: false; name: string; id: string }>,
    default: undefined,
  },
  answersheet: {
    type: Buffer,
    required: true,
  },
  key: {
    type: Buffer,
    required: true,
  },
  cheated: {
    type: Array<{
      _id: false;
      userid: Types.ObjectId;
      is: boolean;
      reason: string;
      timestamp: string;
    }>,
    default: undefined,
  },
  evaluator: {
    type: Types.ObjectId,
    required: true,
  },
  evaluated: {
    type: Boolean,
    default: false,
  },
  isended: {
    type: Boolean,
    default: false,
  },
});

const Evaluation = model<evaluationInterface>(
  'Evaluation',
  evaluationSchema,
  'Evaluations'
);

export { Evaluation };
