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
import { Router } from 'express';

import { AdminRouter } from './api/admin';
import { ExamineeRouter } from './api/examinee';
import { ModeratorRouter } from './api/moderator';

const ApiRouter = Router();

ApiRouter.use('/admin', AdminRouter);

ApiRouter.use('/examinee', ExamineeRouter);

ApiRouter.use('/moderator', ModeratorRouter);

export { ApiRouter };
