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
interface option {
  can_navigate: boolean;
  can_skip: boolean;
  submit_means_final: boolean;
  can_end_test: boolean;
  see_question_list: boolean;
}

interface paper {
  type: 'multiple' | 'single';
  marks: number;
  index: number;
  section: string;
  questionnumber: number;
  question: string;
  option: string[];
  answered: boolean;
  skipped: boolean;
  markedoption: string | string[];
  obtainmarks: number | null;
}

interface ParsedPaper {
  option: option;
  totalmarks: number;
  paper: paper[];
}

const Compiler = (Paper: Buffer) => {
  const ParsedPaper: ParsedPaper = {
    option: {
      'can_navigate': false,
      'can_skip': false,
      'submit_means_final': false,
      'can_end_test': true,
      'see_question_list': true,
    },
    totalmarks: 0,
    paper: [],
  };
  const tokens = lexer(Paper.toString());
  const AST = parser(tokens);
  const paper = generator(AST, ParsedPaper);
  return JSON.stringify(paper);
};

const lexer = (paper: string) => {
  return paper
    .split(';')
    .map((item) => {
      return item.split(':').flatMap((i) => {
        const a = i.trim();
        if (a === '') {
          return [];
        }
        if (
          a.toLowerCase() === 'submit_means_final' ||
          a.toLowerCase() === 'see_question_list' ||
          a.toLowerCase() === 'can_end_test' ||
          a.toLowerCase() === 'can_navigate' ||
          a.toLowerCase() === 'can_skip' ||
          a.toUpperCase() === 'TOTALMARKS' ||
          a.toUpperCase() === 'SECTION' ||
          a.toUpperCase() === 'QUESTION' ||
          a.toUpperCase() === 'MARKS' ||
          a.toUpperCase() === 'TYPE' ||
          a.toUpperCase() === 'OPTION'
        ) {
          return { type: 'token', value: a };
        }
        return {
          type: 'value',
          value: a.replace(/\\CO/gi, ':').replace(/\\SC/gi, ';'),
        };
      });
    })
    .filter((a) => a.length);
};

const parser = (tokens: { type: string; value: string }[][]) => {
  const ast: {
    type: 'option' | 'paper' | 'totalmarks';
    token: string;
    value: string | number | boolean;
  }[] = [];
  let section = false;
  if (!tokens.every(check)) {
    throw new Error('Paper is malformed');
  }
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i][0].value;
    const value = tokens[i][1].value;
    if (
      token.toLowerCase() === 'can_navigate' ||
      token.toLowerCase() === 'can_skip' ||
      token.toLowerCase() === 'can_end_test' ||
      token.toLowerCase() === 'see_question_list' ||
      token.toLowerCase() === 'submit_means_final'
    ) {
      if (value.toLowerCase() === 'true' || value.toLowerCase() === 'false') {
        ast.push({
          type: 'option',
          token: token.toLowerCase(),
          value: JSON.parse(value.toLowerCase()),
        });
      } else {
        throw new Error(
          `${token} has invalid value ${value} instead of true or false`
        );
      }
      if (
        token.toLowerCase() === 'can_navigate' ||
        token.toLowerCase() === 'can_skip'
      ) {
        const l = ast.find((v) => v.token === 'can_skip');
        const m = ast.find((v) => v.token === 'can_navigate');
        if (l === undefined || m === undefined) {
          continue;
        }
        if (
          (l.value === true && m.value === true) ||
          (l.value === false && m.value === false)
        ) {
          throw new Error('can_skip and can_navigate have conflicting values');
        }
      }
    } else if (token.toUpperCase() === 'TOTALMARKS') {
      const l = ast.find((v) => {
        return (
          v.token === 'SECTION' ||
          v.token === 'QUESTION' ||
          v.token === 'MARKS' ||
          v.token === 'TYPE' ||
          v.token === 'OPTION'
        );
      });
      if (l !== undefined) {
        throw new Error(
          'TOTALMARKS has to be before any SECTION, QUESTION, MARKS, TYPE or OPTION'
        );
      }
      if (isNaN(Number(value))) {
        throw new Error(
          `${token} has invalid value ${value} instead of number`
        );
      } else {
        ast.push({
          type: 'totalmarks',
          token: token.toUpperCase(),
          value: Number(value),
        });
      }
    } else if (token.toUpperCase() === 'SECTION') {
      if (!section) {
        const l = ast.find((v) => {
          return (
            v.token === 'QUESTION' ||
            v.token === 'MARKS' ||
            v.token === 'TYPE' ||
            v.token === 'OPTION'
          );
        });
        if (l !== undefined) {
          throw new Error(
            'SECTION has to be before any QUESTION, MARKS, TYPE or OPTION'
          );
        }
        section = true;
      }
      ast.push({ type: 'paper', token: token.toUpperCase(), value: value });
    } else if (token.toUpperCase() === 'QUESTION') {
      const l = ast[ast.length - 1];
      if (
        l.token === 'SECTION' ||
        l.token === 'OPTION' ||
        l.token === 'TOTALMARKS'
      ) {
        ast.push({ type: 'paper', token: token.toUpperCase(), value: value });
      } else {
        throw new Error(`Paper is malformed at line ${i + 1}`);
      }
    } else if (token.toUpperCase() === 'MARKS') {
      const l = ast[ast.length - 1];
      if (l.token === 'QUESTION') {
        if (isNaN(Number(value))) {
          throw new Error(
            `${token} has invalid value ${value} instead of number`
          );
        } else {
          ast.push({
            type: 'paper',
            token: token.toUpperCase(),
            value: Number(value),
          });
        }
      } else {
        throw new Error(`Paper is malformed at line ${i + 1}`);
      }
    } else if (token.toUpperCase() === 'TYPE') {
      const l = ast[ast.length - 1];
      if (l.token === 'MARKS') {
        if (
          value.toLowerCase() === 'single' ||
          value.toLowerCase() === 'multiple'
        ) {
          ast.push({
            type: 'paper',
            token: token.toUpperCase(),
            value: value.toLowerCase(),
          });
        } else {
          throw new Error(
            `${token} has invalid value ${value} instead of single or multiple`
          );
        }
      } else {
        throw new Error(`Paper is malformed at line ${i + 1}`);
      }
    } else if (token.toUpperCase() === 'OPTION') {
      const l = ast[ast.length - 1];
      if (l.token === 'OPTION' || l.token === 'TYPE') {
        ast.push({ type: 'paper', token: token.toUpperCase(), value: value });
      } else {
        throw new Error(`Paper is malformed at line ${i + 1}`);
      }
    } else {
      throw new Error(`${token} is not a valid syntax`);
    }
  }
  const cn = ast.find((v) => {
    return v.token === 'can_navigate';
  });
  const cs = ast.find((v) => {
    return v.token === 'can_skip';
  });
  const tm = ast.find((v) => {
    return v.token === 'TOTALMARKS';
  });
  const q = ast.find((v) => {
    return v.token === 'QUESTION';
  });
  const m = ast.find((v) => {
    return v.token === 'MARKS';
  });
  const t = ast.find((v) => {
    return v.token === 'TYPE';
  });
  const o = ast.find((v) => {
    return v.token === 'OPTION';
  });
  if (cn === undefined && cs === undefined) {
    throw new Error('Either can_skip or can_navigate must be present');
  } else {
    if (cn !== undefined && cn.value === false && cs === undefined) {
      throw new Error('can_navigate is cannot be false');
    } else if (cs !== undefined && cs.value === false && cn === undefined) {
      throw new Error('can_skip is cannot be false');
    }
  }
  if (
    tm === undefined ||
    q === undefined ||
    m === undefined ||
    t === undefined ||
    o === undefined
  ) {
    throw new Error('Paper is malformed');
  }
  return ast;
};

const generator = (
  ast: {
    type: 'option' | 'paper' | 'totalmarks';
    token: string;
    value: string | number | boolean;
  }[],
  paper: ParsedPaper
) => {
  let section = 'default';
  let questionnumber = 0;
  let index = -1;
  for (let i = 0; i < ast.length; i++) {
    const element = ast[i];
    if (element.type === 'option') {
      switch (element.token) {
        case 'can_skip':
          if (typeof element.value === 'boolean')
            paper.option.can_skip = element.value;
          break;

        case 'can_navigate':
          if (typeof element.value === 'boolean')
            paper.option.can_navigate = element.value;
          break;

        case 'can_end_test':
          if (typeof element.value === 'boolean')
            paper.option.can_end_test = element.value;
          break;

        case 'see_question_list':
          if (typeof element.value === 'boolean')
            paper.option.see_question_list = element.value;
          break;

        case 'submit_means_final':
          if (typeof element.value === 'boolean')
            paper.option.submit_means_final = element.value;
          break;

        default:
          throw new Error('Token not matching any case');
      }
    } else if (element.type === 'totalmarks') {
      if (typeof element.value === 'number') paper.totalmarks = element.value;
    } else if (element.type === 'paper') {
      switch (element.token) {
        case 'SECTION':
          if (typeof element.value === 'string') section = element.value;
          questionnumber = 0;
          break;

        case 'QUESTION':
          questionnumber += 1;
          index += 1;
          if (typeof element.value === 'string')
            paper.paper.push({
              section: section,
              index: index,
              questionnumber: questionnumber,
              question: element.value,
              marks: 0,
              type: 'single',
              option: [],
              answered: false,
              skipped: false,
              markedoption: '',
              obtainmarks: null,
            });
          break;

        case 'MARKS':
          const m = paper.paper[index];
          if (typeof element.value === 'number') m.marks = element.value;
          break;

        case 'TYPE':
          const t = paper.paper[index];
          if (element.value === 'single' || element.value === 'multiple')
            t.type = element.value;
          if (element.value === 'multiple') t.markedoption = [];
          break;

        case 'OPTION':
          const o = paper.paper[index];
          if (typeof element.value === 'string') o.option.push(element.value);
          break;

        default:
          break;
      }
    } else {
      throw new Error('Paper is malformed');
    }
  }
  return paper;
};

const check = (va: { type: string; value: string }[]) => {
  if (va.length !== 2) {
    return false;
  }
  let t = false;
  let v = false;
  for (let i = 0; i < va.length; i++) {
    const e = va[i];
    if (e.type === 'token' && t === false) {
      t = true;
    }
    if (e.type === 'value' && v === false) {
      v = true;
    }
  }
  if (t === false || v === false) {
    return false;
  }
  return true;
};

export { Compiler };
