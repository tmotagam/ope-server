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

import { notificationInterface } from '../interface';

const notificationSchema = new Schema({
  UserId: {
    type: Types.ObjectId,
    required: true,
  },
  Date: {
    type: Date,
    required: true,
  },
  type: {
    type: String,
    enum: ['Issue', 'Notification'],
    required: true,
  },
  severity: {
    type: String,
    enum: ['Critical', 'Warning'],
  },
  mark: {
    type: Boolean,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  detail: {
    type: String,
    required: true,
  },
  notify: {
    type: Boolean,
  },
});

const Notification = model<notificationInterface>(
  'Notification',
  notificationSchema,
  'Notifications'
);

export { Notification };
