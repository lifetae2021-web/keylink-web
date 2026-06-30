'use client';

import { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  UploadCloud, FileSpreadsheet, Download, AlertTriangle, CheckCircle2,
  RefreshCw, Search, AlertCircle, HelpCircle, Wand2, ChevronDown,
  Users, UserCheck, ScanLine, Settings2, X, Eye
} from 'lucide-react';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────
interface ParsedRow {
  _rowIndex: number;
  name: string;
  gender: string;
  birthYear: string;
  height: string;
  age: string;
  region: string;
  job: string;
  idealType: string;
  nonIdealType: string;
  photo: string;
  _warnings: string[];   // 빈 필드 목록
  _raw: any[];           // 원본 행 데이터
  _textBlock: boolean;   // 복붙 텍스트 방식으로 파싱됐는지 여부
}

interface ColumnMap {
  name: number;
  gender: number;
  birthYear: number;
  height: number;
  age: number;
  region: number;
  job: number;
  idealType: number;
  nonIdealType: number;
  photo: number;
}

const FIELD_LABELS: Record<keyof ColumnMap, string> = {
  name: '이름',
  gender: '성별',
  birthYear: '년생',
  height: '키',
  age: '나이',
  region: '거주지역',
  job: '직업',
  idealType: '이상형',
  nonIdealType: '비선호형',
  photo: '사진',
};

// ─────────────────────────────────────────────
// 키워드 기반 헤더 감지
// ─────────────────────────────────────────────
const FIELD_KEYWORDS: Record<keyof ColumnMap, string[]> = {
  name:        ['이름', '성함', 'name'],
  gender:      ['성별', 'gender', '남여', '남/여'],
  birthYear:   ['년생', '생년', '출생', '생일', '생년월일', 'birth', '나이(년생)', '몇년생'],
  height:      ['키', '신장', 'height', '키(cm)'],
  age:         ['나이', 'age', '만 나이'],
  region:      ['거주', '지역', '주소', 'location', '사는 곳', '사는곳', '어디 사세요', '거주지', '거주 지역'],
  job:         ['직업', '직종', '회사', '직장', 'job', 'work', '하는 일', '무슨 일', '어떤 일'],
  idealType:   ['이상형', '선호', '좋아하는 타입', '원하는 이성상', '원하는 스타일', '이성으로'],
  nonIdealType:['비선호', '싫어하는', '피하고 싶은', '별로인 타입', '안 맞는', '비호감', '거부감', '꺼리는'],
  photo:       ['사진', 'photo', 'image', '이미지', 'drive.google', '본인 사진', '프로필 사진'],
};

function detectColumns(headers: any[]): ColumnMap {
  const map: ColumnMap = {
    name: -1, gender: -1, birthYear: -1, height: -1, age: -1,
    region: -1, job: -1, idealType: -1, nonIdealType: -1, photo: -1,
  };
  headers.forEach((h, i) => {
    if (!h) return;
    const lower = String(h).toLowerCase().trim();
    (Object.keys(map) as (keyof ColumnMap)[]).forEach(field => {
      if (map[field] !== -1) return; // 이미 찾음
      if (FIELD_KEYWORDS[field].some(kw => lower.includes(kw.toLowerCase()))) {
        map[field] = i;
      }
    });
  });
  return map;
}

// ─────────────────────────────────────────────
// 통째로 복붙된 텍스트 셀 파서
// ─────────────────────────────────────────────
const TEXT_PATTERNS: Record<keyof ColumnMap, RegExp[]> = {
  name:        [/이름\s*[:：]\s*([가-힣a-zA-Z]{2,5})/i, /성함\s*[:：]\s*([가-힣a-zA-Z]{2,5})/i],
  gender:      [/성별\s*[:：]\s*(남자?|여자?|남성|여성)/i],
  birthYear:   [/년생\s*[:：]\s*(\d{2,4})/, /생년\s*[:：]\s*(\d{2,4})/, /(\d{4})년생/, /(\d{2})년생/],
  height:      [/키\s*[:：]?\s*(\d{3})\s*(?:cm)?/i, /신장\s*[:：]?\s*(\d{3})/i],
  age:         [/나이\s*[:：]\s*(\d{1,2})/i, /만\s*(\d{1,2})\s*세/i],
  region:      [/거주\s*(?:지역|지)?\s*[:：]\s*([가-힣\s]{2,20})/i, /지역\s*[:：]\s*([가-힣\s]{2,20})/i, /사는\s*곳\s*[:：]\s*([가-힣\s]{2,20})/i],
  job:         [/직업\s*[:：]\s*(.{2,30}?)(?:[\/\n,]|$)/i, /직종\s*[:：]\s*(.{2,30}?)(?:[\/\n,]|$)/i, /하는\s*일\s*[:：]\s*(.{2,30}?)(?:[\/\n,]|$)/i],
  idealType:   [/이상형\s*[:：]\s*(.{2,100}?)(?:[\/\n]|$)/i, /선호(?:하는)?\s*타입?\s*[:：]\s*(.{2,100}?)(?:[\/\n]|$)/i],
  nonIdealType:[/비선호\s*[:：]\s*(.{2,100}?)(?:[\/\n]|$)/i, /싫어하는\s*[:：]\s*(.{2,100}?)(?:[\/\n]|$)/i, /피하고\s*싶은\s*[:：]\s*(.{2,100}?)(?:[\/\n]|$)/i],
  photo:       [/(https?:\/\/drive\.google\.com\/\S+)/i, /(https?:\/\/\S+\.(?:jpg|jpeg|png|webp|gif))/i],
};

function parseTextBlock(text: string): Partial<Record<keyof ColumnMap, string>> {
  const result: Partial<Record<keyof ColumnMap, string>> = {};
  (Object.keys(TEXT_PATTERNS) as (keyof ColumnMap)[]).forEach(field => {
    for (const pattern of TEXT_PATTERNS[field]) {
      const m = text.match(pattern);
      if (m && m[1]) {
        result[field] = m[1].trim();
        break;
      }
    }
  });
  return result;
}

// ─────────────────────────────────────────────
// 행 단위 폴백 스캐너
// ─────────────────────────────────────────────
function fallbackScanRow(cells: any[]): Partial<Record<keyof ColumnMap, string>> {
  const result: Partial<Record<keyof ColumnMap, string>> = {};
  const joined = cells.map(c => String(c ?? '')).join(' ');

  // 성별
  if (!result.gender) {
    for (const c of cells) {
      const v = String(c ?? '').trim();
      if (v === '남' || v === '남자' || v === '남성') { result.gender = '남자'; break; }
      if (v === '여' || v === '여자' || v === '여성') { result.gender = '여자'; break; }
    }
  }
  // 키 (150~200 사이의 숫자)
  if (!result.height) {
    for (const c of cells) {
      const num = parseInt(String(c ?? ''), 10);
      if (num >= 150 && num <= 205) { result.height = String(num); break; }
    }
  }
  // 년생 (80~09 두 자리 또는 1980~2009 네 자리)
  if (!result.birthYear) {
    for (const c of cells) {
      const v = String(c ?? '').replace(/[^0-9]/g, '');
      if (v.length === 6 || v.length === 8) {
        // 생년월일 형태면 앞 2자리 또는 4자리 추출
        const prefix = parseInt(v.slice(0, 2), 10);
        const fullYear = prefix <= 20 ? `20${v.slice(0, 2)}` : `19${v.slice(0, 2)}`;
        result.birthYear = fullYear;
        break;
      }
      if (v.length === 2) {
        const n = parseInt(v, 10);
        if ((n >= 70 && n <= 99) || (n >= 0 && n <= 10)) {
          result.birthYear = n <= 10 ? `20${v.padStart(2, '0')}` : `19${v}`;
          break;
        }
      }
      if (v.length === 4) {
        const n = parseInt(v, 10);
        if (n >= 1970 && n <= 2010) { result.birthYear = v; break; }
      }
    }
  }
  // 구글 드라이브 사진 링크
  const driveMatch = joined.match(/(https?:\/\/drive\.google\.com\/\S+)/i);
  if (driveMatch) result.photo = driveMatch[1];
  // 이미지 URL
  if (!result.photo) {
    const imgMatch = joined.match(/(https?:\/\/\S+\.(?:jpg|jpeg|png|webp|gif))/i);
    if (imgMatch) result.photo = imgMatch[1];
  }

  return result;
}

// ─────────────────────────────────────────────
// 성별 정규화
// ─────────────────────────────────────────────
function normalizeGender(raw: string): string {
  const v = String(raw ?? '').trim();
  if (/^남/.test(v)) return '남자';
  if (/^여/.test(v)) return '여자';
  return v;
}

// ─────────────────────────────────────────────
// 년생 정규화
// ─────────────────────────────────────────────
function normalizeBirthYear(raw: string): string {
  const digits = String(raw ?? '').replace(/[^0-9]/g, '');
  if (digits.length >= 8) {
    // 생년월일 → 연도만
    return digits.slice(0, 4);
  }
  if (digits.length === 6) {
    // 6자리 yyMMdd → 연도 추출
    const yy = parseInt(digits.slice(0, 2), 10);
    return yy <= 20 ? `20${digits.slice(0, 2)}` : `19${digits.slice(0, 2)}`;
  }
  if (digits.length === 4) return digits;
  if (digits.length === 2) {
    const n = parseInt(digits, 10);
    return n <= 20 ? `20${digits.padStart(2, '0')}` : `19${digits}`;
  }
  return raw;
}

// ─────────────────────────────────────────────
// 단일 행 파싱 (통합 로직)
// ─────────────────────────────────────────────
function parseParticipantRow(row: any[], colMap: ColumnMap, rowIndex: number): ParsedRow {
  const get = (col: number) => (col !== -1 && col < row.length ? String(row[col] ?? '').trim() : '');

  // 1. 한 셀에 모든 내용이 통째로 들어온 경우 감지
  const allCellText = row.map(c => String(c ?? '')).join('\n');
  const hasKeywordColon = /[이름성별키직업거주나이이상형비선호]\s*[:：]/.test(allCellText);
  let textBlockResult: Partial<Record<keyof ColumnMap, string>> = {};
  if (hasKeywordColon) {
    textBlockResult = parseTextBlock(allCellText);
  }

  // 2. 컬럼 매핑으로 기본값 추출
  const fromCol: Record<keyof ColumnMap, string> = {
    name:        get(colMap.name),
    gender:      get(colMap.gender),
    birthYear:   get(colMap.birthYear),
    height:      get(colMap.height),
    age:         get(colMap.age),
    region:      get(colMap.region),
    job:         get(colMap.job),
    idealType:   get(colMap.idealType),
    nonIdealType:get(colMap.nonIdealType),
    photo:       get(colMap.photo),
  };

  // 3. 폴백 스캐너
  const fallback = fallbackScanRow(row);

  // 4. 우선순위: 텍스트파서 > 컬럼매핑 > 폴백
  const merged: Record<keyof ColumnMap, string> = {} as any;
  (Object.keys(FIELD_LABELS) as (keyof ColumnMap)[]).forEach(f => {
    merged[f] = textBlockResult[f] || fromCol[f] || fallback[f] || '';
  });

  // 5. 정규화
  merged.gender    = normalizeGender(merged.gender);
  merged.birthYear = normalizeBirthYear(merged.birthYear);
  merged.height    = merged.height.replace(/[^0-9.]/g, '');

  // 6. 경고 생성 (비어있는 핵심 필드 목록)
  const coreFields: (keyof ColumnMap)[] = ['name', 'gender', 'birthYear', 'height', 'region', 'job'];
  const warnings = coreFields.filter(f => !merged[f]).map(f => FIELD_LABELS[f]);

  return {
    _rowIndex:   rowIndex,
    name:        merged.name,
    gender:      merged.gender,
    birthYear:   merged.birthYear,
    height:      merged.height,
    age:         merged.age,
    region:      merged.region,
    job:         merged.job,
    idealType:   merged.idealType,
    nonIdealType:merged.nonIdealType,
    photo:       merged.photo,
    _warnings:   warnings,
    _raw:        row,
    _textBlock:  hasKeywordColon,
  };
}

// ─────────────────────────────────────────────
// 컴포넌트
// ─────────────────────────────────────────────
export default function ExcelCleanerPage() {
  // ── 탭 ──
  const [activeTab, setActiveTab] = useState<'smart' | 'legacy'>('smart');

  // ── 스마트 파서 상태 ──
  const [smartFileName, setSmartFileName] = useState('');
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<any[][]>([]);
  const [colMap, setColMap] = useState<ColumnMap>({
    name: -1, gender: -1, birthYear: -1, height: -1, age: -1,
    region: -1, job: -1, idealType: -1, nonIdealType: -1, photo: -1,
  });
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [smartSearch, setSmartSearch] = useState('');
  const [showMapper, setShowMapper] = useState(false);
  const [smartDragActive, setSmartDragActive] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  const smartFileRef = useRef<HTMLInputElement>(null);

  // ── 레거시 파서 상태 ──
  const [legacyData, setLegacyData] = useState<any[][]>([]);
  const [legacyFileName, setLegacyFileName] = useState('');
  const [legacyDragActive, setLegacyDragActive] = useState(false);
  const [legacySearch, setLegacySearch] = useState('');
  const legacyFileRef = useRef<HTMLInputElement>(null);

  // ─── 스마트 파서 파일 처리 ───────────────────────
  const handleSmartFile = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext ?? '')) {
      toast.error('엑셀 또는 CSV 파일만 업로드할 수 있습니다.');
      return;
    }
    setSmartFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const ab = e.target?.result as ArrayBuffer;
        const wb = XLSX.read(new Uint8Array(ab), { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const all: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
        if (all.length < 2) { toast.error('데이터가 없습니다.'); return; }

        const headers = all[0].map(h => String(h ?? ''));
        const rows = all.slice(1).filter(r => r.some(c => c !== undefined && c !== null && c !== ''));
        const detected = detectColumns(headers);

        setRawHeaders(headers);
        setRawRows(rows);
        setColMap(detected);

        // 파싱
        const parsed = rows.map((r, i) => parseParticipantRow(r, detected, i + 2));
        setParsedRows(parsed);

        const missingFields = (Object.keys(detected) as (keyof ColumnMap)[])
          .filter(f => detected[f] === -1)
          .map(f => FIELD_LABELS[f]);

        if (missingFields.length > 0) {
          toast(`자동 감지 실패 열: ${missingFields.join(', ')}`, { icon: '⚠️', duration: 5000 });
        } else {
          toast.success(`${parsed.length}명 파싱 완료!`);
        }
      } catch (err) {
        console.error(err);
        toast.error('파일을 읽는 중 오류가 발생했습니다.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // colMap이 바뀌면 파싱 재실행
  const reParse = (newMap: ColumnMap) => {
    if (rawRows.length === 0) return;
    const parsed = rawRows.map((r, i) => parseParticipantRow(r, newMap, i + 2));
    setParsedRows(parsed);
  };

  const updateColMap = (field: keyof ColumnMap, idx: number) => {
    const next = { ...colMap, [field]: idx };
    setColMap(next);
    reParse(next);
  };

  // ─── 스마트 파서 엑셀 다운로드 ────────────────────
  const downloadSmartExcel = () => {
    if (parsedRows.length === 0) { toast.error('다운로드할 데이터가 없습니다.'); return; }
    const headers = ['이름', '성별', '년생', '키', '나이', '거주지역', '직업', '이상형', '비선호형', '사진링크', '경고'];
    const rows = parsedRows.map(r => [
      r.name, r.gender, r.birthYear, r.height, r.age, r.region, r.job,
      r.idealType, r.nonIdealType, r.photo,
      r._warnings.length > 0 ? `[누락] ${r._warnings.join(', ')}` : ''
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '파싱결과');
    XLSX.writeFile(wb, '구글폼_파싱결과.xlsx');
    toast.success('엑셀 다운로드 완료!');
  };

  // ─── 스마트 파서 통계 ──────────────────────────────
  const smartStats = useMemo(() => {
    const male = parsedRows.filter(r => r.gender === '남자').length;
    const female = parsedRows.filter(r => r.gender === '여자').length;
    const hasWarnings = parsedRows.filter(r => r._warnings.length > 0).length;
    const textBlock = parsedRows.filter(r => r._textBlock).length;
    return { total: parsedRows.length, male, female, hasWarnings, textBlock };
  }, [parsedRows]);

  // ─── 스마트 파서 필터링 ────────────────────────────
  const filteredParsed = useMemo(() => {
    if (!smartSearch.trim()) return parsedRows;
    const q = smartSearch.toLowerCase();
    return parsedRows.filter(r =>
      r.name.includes(q) || r.region.includes(q) || r.job.includes(q) ||
      r.gender.includes(q) || r.birthYear.includes(q)
    );
  }, [parsedRows, smartSearch]);

  // ─── 레거시 파서 ──────────────────────────────────
  const legacyTransform = (rawData: any[][], ws: XLSX.WorkSheet): any[][] => {
    if (!rawData || rawData.length === 0) return [];
    const originalHeaders = rawData[0];
    const targetColumns = [
      '회차', '성별', '이름', '외모', '종교', '년생', '거주지', '직업',
      '직업 1~5점', '키or몸무게 1~5점', '자기관리 0~2점', '득표 0~7점',
      '1순위 3점', '2순위 2점', '3순위 1점', '후기 유무', '총점', '이상형', '메모'
    ];
    const getIndex = (keyword: string) =>
      originalHeaders.findIndex((h: any) => h && String(h).includes(keyword));
    const idxMap: Record<string, number> = {
      '성별': getIndex('6. 성별'), '이름': getIndex('5. 이름'),
      '종교': getIndex('18. 종교'), '년생': getIndex('7. 생년월일'),
      '거주지': getIndex('10. 거주 지역'), '직업': getIndex('11. 회사명'),
      '이상형': getIndex('12. 이상형')
    };
    const scoreCols = ['직업 1~5점', '키or몸무게 1~5점', '자기관리 0~2점', '득표 0~7점', '1순위 3점', '2순위 2점', '3순위 1점', '총점'];
    const newData: any[][] = [targetColumns];
    const tempRows: { row: any[]; isPriority: boolean }[] = [];
    const nameCounts: Record<string, number> = {};
    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || row.length === 0) continue;
      const newRow = new Array(targetColumns.length).fill('');
      let isPriority = false;
      targetColumns.forEach((col, index) => {
        if (scoreCols.includes(col)) {
          newRow[index] = 0;
        } else if (idxMap[col] !== undefined && idxMap[col] !== -1) {
          let cellVal = row[idxMap[col]];
          if (cellVal === undefined || cellVal === null) cellVal = '';
          if (col === '이름' && cellVal) {
            const strVal = String(cellVal);
            const match = strVal.match(/(\d+)기/);
            if (match) { newRow[targetColumns.indexOf('회차')] = match[1] + '기'; isPriority = true; }
            cellVal = strVal.replace(/\d+기\s*/g, '').trim();
          }
          if (col === '성별' && cellVal) {
            const strVal = String(cellVal);
            if (strVal.includes('여')) cellVal = '여자';
            else if (strVal.includes('남')) cellVal = '남자';
          }
          if (col === '종교') {
            let foundReligion = '';
            const relKeywords = ['기독교', '천주교', '무교', '불교'];
            const strVal = String(cellVal || '');
            for (const k of relKeywords) { if (strVal.includes(k)) { foundReligion = k; break; } }
            if (!foundReligion) {
              const rowStr = row.map((cell: any) => String(cell || '')).join(' ');
              for (const k of relKeywords) { if (rowStr.includes(k)) { foundReligion = k; break; } }
            }
            cellVal = foundReligion;
          }
          if (col === '년생' && cellVal) {
            const digits = String(cellVal).replace(/\D/g, '');
            if (digits.length >= 8) { cellVal = digits.substring(0, 4); }
            else if (digits.length >= 6) {
              const prefix = parseInt(digits.substring(0, 2), 10);
              cellVal = (prefix <= 29 ? '20' : '19') + digits.substring(0, 2);
            }
          }
          newRow[index] = cellVal;
        }
      });
      if (ws) {
        for (let c = 0; c < row.length; c++) {
          const cellRef = XLSX.utils.encode_cell({ r: i, c });
          const cell = ws[cellRef];
          if (cell && cell.s && cell.s.fgColor) {
            const colorStr = String(cell.s.fgColor.rgb || cell.s.fgColor.theme || '');
            if (colorStr && colorStr !== 'FFFFFFFF' && colorStr !== 'FFFFFF' && colorStr !== '000000') {
              isPriority = true; break;
            }
          }
        }
      }
      const nameVal = newRow[targetColumns.indexOf('이름')];
      if (nameVal) nameCounts[nameVal] = (nameCounts[nameVal] || 0) + 1;
      tempRows.push({ row: newRow, isPriority });
    }
    const priorityRows: any[][] = [];
    const normalRows: any[][] = [];
    const memoIndex = targetColumns.indexOf('메모');
    const nameIndex = targetColumns.indexOf('이름');
    const sortByEpisode = (a: any[], b: any[]) => {
      const getNum = (val: any) => { if (!val) return 999999; const match = String(val).match(/\d+/); return match ? parseInt(match[0], 10) : 999999; };
      return getNum(a[0]) - getNum(b[0]);
    };
    tempRows.forEach(item => {
      const row = item.row;
      const nameVal = row[nameIndex];
      if (nameVal && nameCounts[nameVal] > 1) row[memoIndex] = row[memoIndex] ? row[memoIndex] + ' [중복 제출]' : '[중복 제출]';
      if (item.isPriority) priorityRows.push(row); else normalRows.push(row);
    });
    priorityRows.sort(sortByEpisode);
    normalRows.sort(sortByEpisode);
    newData.push(...priorityRows, ...normalRows);
    return newData;
  };

  const handleLegacyFile = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext ?? '')) { toast.error('엑셀 파일만 업로드 가능합니다.'); return; }
    setLegacyFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const ab = e.target?.result as ArrayBuffer;
        const wb = XLSX.read(new Uint8Array(ab), { type: 'array', cellStyles: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
        if (raw.length === 0) { toast.error('데이터가 없습니다.'); return; }
        setLegacyData(legacyTransform(raw, ws));
        toast.success('엑셀 가공 완료!');
      } catch { toast.error('파일 읽기 오류'); }
    };
    reader.readAsArrayBuffer(file);
  };

  const narrowCols = ['회차', '성별', '외모', '종교', '년생', '직업 1~5점', '키or몸무게 1~5점', '자기관리 0~2점', '득표 0~7점', '1순위 3점', '2순위 2점', '3순위 1점', '후기 유무', '총점'];
  const legacyNarrowIndices = useMemo(() => {
    if (legacyData.length === 0) return [];
    return legacyData[0].map((h: any, i: number) => narrowCols.includes(String(h)) ? i : -1).filter((i: number) => i !== -1);
  }, [legacyData]);

  const legacyStats = useMemo(() => {
    if (legacyData.length <= 1) return { total: 0, male: 0, female: 0, priority: 0, duplicate: 0 };
    const rows = legacyData.slice(1);
    return {
      total: rows.length,
      male: rows.filter(r => r[1] === '남자').length,
      female: rows.filter(r => r[1] === '여자').length,
      priority: rows.filter(r => r[0]).length,
      duplicate: rows.filter(r => r[18] && String(r[18]).includes('[중복 제출]')).length,
    };
  }, [legacyData]);

  const filteredLegacy = useMemo(() => {
    if (legacyData.length <= 1) return [];
    const rows = legacyData.slice(1);
    if (!legacySearch.trim()) return rows;
    const q = legacySearch.toLowerCase();
    return rows.filter(row => row.some((cell: any) => String(cell ?? '').toLowerCase().includes(q)));
  }, [legacyData, legacySearch]);

  const downloadLegacyExcel = () => {
    if (!legacyData || legacyData.length === 0) { toast.error('데이터 없음'); return; }
    const ws = XLSX.utils.aoa_to_sheet(legacyData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '참여자 명단');
    XLSX.writeFile(wb, '참여자_명단_정리.xlsx');
    toast.success('다운로드 완료!');
  };

  // ─────────────────────────────────────────────
  // 렌더
  // ─────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-in fade-in duration-400">
      {/* 헤더 */}
      <div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A' }}>참여자 엑셀 정리기</h2>
        <p className="text-slate-500 text-xs mt-1">구글 설문 등으로 제출된 참여자 명단을 파싱·정제합니다.</p>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit border border-slate-200">
        {[
          { id: 'smart', label: '🧠 스마트 구글폼 파서', icon: Wand2 },
          { id: 'legacy', label: '📋 DB 포맷 정리기', icon: FileSpreadsheet },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition-all"
            style={{
              background: activeTab === tab.id ? '#fff' : 'transparent',
              color: activeTab === tab.id ? '#FF6F61' : '#94A3B8',
              boxShadow: activeTab === tab.id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            <tab.icon size={13} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════
          탭 A: 스마트 구글폼 파서
          ════════════════════════════════════════════════════ */}
      {activeTab === 'smart' && (
        <div className="space-y-5">
          {parsedRows.length === 0 ? (
            /* 업로드 존 */
            <div
              onDragEnter={e => { e.preventDefault(); setSmartDragActive(true); }}
              onDragOver={e => { e.preventDefault(); setSmartDragActive(true); }}
              onDragLeave={e => { e.preventDefault(); setSmartDragActive(false); }}
              onDrop={e => { e.preventDefault(); setSmartDragActive(false); if (e.dataTransfer.files[0]) handleSmartFile(e.dataTransfer.files[0]); }}
              onClick={() => smartFileRef.current?.click()}
              className={`relative border-2 border-dashed rounded-2xl flex flex-col items-center justify-center py-20 px-6 text-center cursor-pointer transition-all duration-300 ${smartDragActive ? 'border-[#FF7E7E] bg-rose-50/50' : 'border-slate-300 hover:border-[#FF7E7E]/70 bg-white hover:bg-slate-50/50'}`}
              style={{ minHeight: 340 }}
            >
              <input ref={smartFileRef} type="file" className="hidden" accept=".xlsx,.xls,.csv"
                onChange={e => { if (e.target.files?.[0]) handleSmartFile(e.target.files[0]); }} />
              <div className="w-16 h-16 rounded-full bg-violet-50 flex items-center justify-center mb-5 text-violet-500">
                <ScanLine size={32} />
              </div>
              <h3 className="text-base font-bold text-slate-800">구글폼 엑셀 파일을 끌어다 놓으세요</h3>
              <p className="text-xs text-slate-500 mt-2 max-w-sm leading-relaxed">
                열 순서가 달라도 자동 감지합니다. 한 셀에 통째로 복사·붙여넣기된 데이터도 분석합니다.
              </p>
              <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-violet-50 border border-violet-100 rounded-xl text-violet-600 font-bold text-xs">
                <Wand2 size={13} /> 파일 선택하기
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* 상단 액션 바 */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                    📁 {smartFileName}
                  </span>
                  <button
                    onClick={() => setShowMapper(v => !v)}
                    className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all border"
                    style={{ background: showMapper ? '#F5F3FF' : '#fff', color: showMapper ? '#7C3AED' : '#64748B', borderColor: showMapper ? '#C4B5FD' : '#E2E8F0' }}
                  >
                    <Settings2 size={13} /> 열 매핑 {showMapper ? '닫기' : '조정'}
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setParsedRows([]); setRawRows([]); setRawHeaders([]); setSmartFileName(''); }}
                    className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition-all hover:bg-slate-100"
                    style={{ background: '#fff', border: '1px solid #E2E8F0', color: '#64748B' }}
                  >
                    <RefreshCw size={13} /> 초기화
                  </button>
                  <button
                    onClick={downloadSmartExcel}
                    className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold text-white transition-all shadow-md hover:opacity-90"
                    style={{ background: '#7C3AED', boxShadow: '0 4px 12px rgba(124,58,237,0.2)' }}
                  >
                    <Download size={13} /> 정제 결과 다운로드
                  </button>
                </div>
              </div>

              {/* 열 매핑 드롭다운 패널 */}
              {showMapper && (
                <div className="bg-white border border-violet-100 rounded-2xl p-5 space-y-3 shadow-sm">
                  <h4 className="text-xs font-black text-violet-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Settings2 size={13} /> 자동 감지 결과 확인 및 수동 수정
                  </h4>
                  <p className="text-[11px] text-slate-500">자동으로 찾지 못한 열이 있으면 드롭다운에서 직접 지정해주세요.</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                    {(Object.keys(FIELD_LABELS) as (keyof ColumnMap)[]).map(field => (
                      <div key={field} className="flex flex-col gap-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">{FIELD_LABELS[field]}</label>
                        <div className="relative">
                          <select
                            value={colMap[field]}
                            onChange={e => updateColMap(field, parseInt(e.target.value, 10))}
                            className="w-full text-xs border rounded-lg px-2 py-1.5 appearance-none pr-6 outline-none focus:border-violet-400 transition-all"
                            style={{
                              background: colMap[field] === -1 ? '#FEF2F2' : '#F5F3FF',
                              borderColor: colMap[field] === -1 ? '#FCA5A5' : '#C4B5FD',
                              color: colMap[field] === -1 ? '#DC2626' : '#5B21B6',
                              fontWeight: 700,
                            }}
                          >
                            <option value={-1}>— 자동 감지 안 됨</option>
                            {rawHeaders.map((h, i) => (
                              <option key={i} value={i}>{i}: {h}</option>
                            ))}
                          </select>
                          <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 통계 카드 */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                  { label: '총 참여자', value: smartStats.total, unit: '명', color: '#0F172A' },
                  { label: '남성', value: smartStats.male, unit: '명', color: '#2563EB' },
                  { label: '여성', value: smartStats.female, unit: '명', color: '#DB2777' },
                  { label: '복붙 텍스트', value: smartStats.textBlock, unit: '건', color: '#7C3AED' },
                  { label: '주의 필요', value: smartStats.hasWarnings, unit: '건', color: '#D97706' },
                ].map(s => (
                  <div key={s.label} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">{s.label}</span>
                    <div className="flex items-baseline gap-1 mt-2">
                      <span className="text-2xl font-black" style={{ color: s.color }}>{s.value}</span>
                      <span className="text-xs text-slate-500 font-bold">{s.unit}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* 검색 + 테이블 */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center gap-3">
                  <div className="relative flex-1 max-w-xs">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="이름, 지역, 직업 검색..."
                      value={smartSearch}
                      onChange={e => setSmartSearch(e.target.value)}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl py-2 pl-8 pr-3 outline-none focus:border-violet-300 transition-all"
                    />
                  </div>
                  <span className="text-xs text-slate-400 font-bold ml-auto">{filteredParsed.length}명 표시</span>
                </div>

                <div className="overflow-x-auto max-h-[540px] kl-scrollbar">
                  <table className="w-full border-collapse text-left text-xs table-fixed">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                        {['#', '이름', '성별', '년생', '키', '나이', '거주지역', '직업', '이상형', '비선호형', '사진', '상태'].map((h, i) => (
                          <th key={i} className="py-3 px-3 font-black text-slate-600 border-r border-slate-200 last:border-r-0 whitespace-nowrap"
                            style={{ minWidth: i === 0 ? 36 : i >= 7 ? 130 : 80, width: i === 0 ? 36 : i >= 7 ? 130 : 80 }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredParsed.length === 0 ? (
                        <tr><td colSpan={12} className="py-10 text-center text-slate-400 font-bold">검색 결과가 없습니다.</td></tr>
                      ) : filteredParsed.map((row, idx) => {
                        const hasWarn = row._warnings.length > 0;
                        const isTextBlock = row._textBlock;
                        return (
                          <tr key={row._rowIndex}
                            className={`border-b border-slate-100 hover:bg-slate-50/50 transition-colors last:border-0 ${hasWarn ? 'bg-amber-50/40' : ''}`}
                          >
                            <td className="py-2.5 px-3 text-slate-400 border-r border-slate-100">{idx + 1}</td>
                            <td className="py-2.5 px-3 font-bold text-slate-800 border-r border-slate-100 truncate">{row.name || <span className="text-slate-300">—</span>}</td>
                            <td className={`py-2.5 px-3 font-bold border-r border-slate-100 ${row.gender === '남자' ? 'text-blue-500' : row.gender === '여자' ? 'text-rose-500' : 'text-slate-300'}`}>
                              {row.gender || '—'}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 border-r border-slate-100">{row.birthYear || <span className="text-slate-300">—</span>}</td>
                            <td className="py-2.5 px-3 text-slate-600 border-r border-slate-100">{row.height ? `${row.height}cm` : <span className="text-slate-300">—</span>}</td>
                            <td className="py-2.5 px-3 text-slate-600 border-r border-slate-100">{row.age || <span className="text-slate-300">—</span>}</td>
                            <td className="py-2.5 px-3 text-slate-600 border-r border-slate-100 truncate">{row.region || <span className="text-slate-300">—</span>}</td>
                            <td className="py-2.5 px-3 text-slate-600 border-r border-slate-100 truncate" title={row.job}>{row.job || <span className="text-slate-300">—</span>}</td>
                            <td className="py-2.5 px-3 text-slate-600 border-r border-slate-100 truncate" title={row.idealType}>{row.idealType || <span className="text-slate-300">—</span>}</td>
                            <td className="py-2.5 px-3 text-slate-600 border-r border-slate-100 truncate" title={row.nonIdealType}>{row.nonIdealType || <span className="text-slate-300">—</span>}</td>
                            <td className="py-2.5 px-3 border-r border-slate-100">
                              {row.photo ? (
                                <button
                                  onClick={() => setPreviewPhoto(row.photo)}
                                  className="flex items-center gap-1 text-violet-600 font-bold hover:underline text-[10px]"
                                >
                                  <Eye size={11} /> 보기
                                </button>
                              ) : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex gap-1 flex-wrap">
                                {isTextBlock && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-violet-100 text-violet-700 border border-violet-200">복붙</span>
                                )}
                                {hasWarn ? (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-100 text-amber-700 border border-amber-200" title={`누락: ${row._warnings.join(', ')}`}>
                                    ⚠️ {row._warnings.length}개 누락
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-100 text-emerald-700 border border-emerald-200">✓ 정상</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 가이드 카드 */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-4">
              <HelpCircle size={15} className="text-slate-400" /> 스마트 파서 동작 방식
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-[11px] text-slate-600 leading-relaxed">
              <div className="space-y-1.5">
                <h4 className="font-black text-slate-800 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-500" /> 키워드 기반 열 자동 감지
                </h4>
                <p>헤더를 스캔하여 `이름/성함`, `성별`, `키/신장`, `거주/지역`, `직업/직종` 등 유사 키워드로 열의 위치를 자동으로 추론합니다. 설문지 양식이 달라져도 작동합니다.</p>
              </div>
              <div className="space-y-1.5">
                <h4 className="font-black text-slate-800 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> 행 단위 보정 스캔
                </h4>
                <p>열 값이 비어 있거나 엉뚱한 곳에 들어간 경우, 그 행 전체를 스캔하여 150~200 범위의 숫자(키), 남/여 단어(성별), 6~8자리 숫자(생년월일)를 자동으로 찾아냅니다.</p>
              </div>
              <div className="space-y-1.5">
                <h4 className="font-black text-slate-800 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> 복붙 텍스트 블록 파싱
                </h4>
                <p>구글폼을 그대로 복사해서 한 셀에 붙여넣은 경우, `이름: 홍길동 / 키: 180` 같은 패턴을 정규표현식으로 분석하여 각 필드를 추출합니다. 보라색 `복붙` 뱃지로 표시됩니다.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════
          탭 B: 레거시 DB 포맷 정리기
          ════════════════════════════════════════════════════ */}
      {activeTab === 'legacy' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">DB 정렬 방식에 맞춰 데이터를 변환하고 중복 데이터를 색출합니다.</p>
            {legacyData.length > 0 && (
              <div className="flex gap-2">
                <button onClick={() => { setLegacyData([]); setLegacyFileName(''); setLegacySearch(''); toast.success('초기화 완료'); }}
                  className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold hover:bg-slate-100 transition-all"
                  style={{ background: '#fff', border: '1px solid #E2E8F0', color: '#64748B' }}>
                  <RefreshCw size={13} /> 초기화
                </button>
                <button onClick={downloadLegacyExcel}
                  className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold text-white shadow-md hover:opacity-90 transition-all"
                  style={{ background: '#FF7E7E', boxShadow: '0 4px 12px rgba(255,126,126,0.2)' }}>
                  <Download size={13} /> 가공 엑셀 다운로드
                </button>
              </div>
            )}
          </div>

          {legacyData.length === 0 ? (
            <div
              onDragEnter={e => { e.preventDefault(); setLegacyDragActive(true); }}
              onDragOver={e => { e.preventDefault(); setLegacyDragActive(true); }}
              onDragLeave={e => { e.preventDefault(); setLegacyDragActive(false); }}
              onDrop={e => { e.preventDefault(); setLegacyDragActive(false); if (e.dataTransfer.files[0]) handleLegacyFile(e.dataTransfer.files[0]); }}
              onClick={() => legacyFileRef.current?.click()}
              className={`relative border-2 border-dashed rounded-2xl flex flex-col items-center justify-center py-20 px-6 text-center cursor-pointer transition-all duration-300 ${legacyDragActive ? 'border-[#FF7E7E] bg-rose-50/50' : 'border-slate-300 hover:border-[#FF7E7E]/70 bg-white hover:bg-slate-50/50'}`}
              style={{ minHeight: 340 }}
            >
              <input ref={legacyFileRef} type="file" className="hidden" accept=".xlsx,.xls,.csv"
                onChange={e => { if (e.target.files?.[0]) handleLegacyFile(e.target.files[0]); }} />
              <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center mb-5 text-[#FF7E7E]">
                <UploadCloud size={32} />
              </div>
              <h3 className="text-base font-bold text-slate-800">엑셀 파일을 끌어다 놓으세요</h3>
              <p className="text-xs text-slate-500 mt-2 max-w-sm leading-relaxed">
                구글 폼 설문 응답 결과를 드래그 앤 드롭 하거나, 화면을 클릭하여 업로드하세요.
              </p>
              <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 font-bold text-xs">
                <FileSpreadsheet size={14} /> 파일 찾기
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* 통계 */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                  { label: '총 참여자 수', value: legacyStats.total, unit: '명', color: '#0F172A' },
                  { label: '남성', value: legacyStats.male, unit: '명', color: '#2563EB' },
                  { label: '여성', value: legacyStats.female, unit: '명', color: '#DB2777' },
                  { label: '우선순위 노출', value: legacyStats.priority, unit: '건', color: '#D97706' },
                  { label: '중복 의심', value: legacyStats.duplicate, unit: '건', color: '#DC2626' },
                ].map(s => (
                  <div key={s.label} className={`p-4 rounded-2xl border shadow-sm ${s.label === '중복 의심' && s.value > 0 ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200'}`}>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">{s.label}</span>
                    <div className="flex items-baseline gap-1 mt-2">
                      <span className="text-2xl font-black" style={{ color: s.color }}>{s.value}</span>
                      <span className="text-xs text-slate-500 font-bold">{s.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
              {/* 테이블 */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">파일: {legacyFileName}</span>
                  {legacyStats.duplicate > 0 && (
                    <div className="flex items-center gap-1.5 text-xs font-black text-rose-600 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-100 animate-pulse">
                      <AlertTriangle size={12} /> 중복 자동 식별됨
                    </div>
                  )}
                  <div className="relative ml-auto w-56">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="text" placeholder="프리뷰 실시간 검색..." value={legacySearch}
                      onChange={e => setLegacySearch(e.target.value)}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl py-2 pl-8 pr-3 outline-none focus:border-[#FF7E7E]/50 transition-all" />
                  </div>
                </div>
                <div className="overflow-x-auto max-h-[500px] kl-scrollbar">
                  <table className="w-full border-collapse text-left text-xs table-fixed">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                        {legacyData[0]?.map((h: any, i: number) => (
                          <th key={i} className="py-3 px-3 font-bold text-slate-600 bg-slate-50 border-r border-slate-200 last:border-r-0"
                            style={{ width: legacyNarrowIndices.includes(i) ? 90 : 150, minWidth: legacyNarrowIndices.includes(i) ? 90 : 150 }}>
                            {String(h)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLegacy.length === 0 ? (
                        <tr><td colSpan={legacyData[0]?.length || 1} className="py-10 text-center text-slate-400 font-bold">검색 조건에 맞는 데이터가 없습니다.</td></tr>
                      ) : filteredLegacy.map((row: any[], rowIdx: number) => {
                        const isDup = row[18] && String(row[18]).includes('[중복 제출]');
                        return (
                          <tr key={rowIdx} className={`border-b border-slate-100 hover:bg-slate-50/50 transition-colors last:border-0 ${isDup ? 'bg-rose-50/30' : ''}`}>
                            {row.map((cell: any, cellIdx: number) => {
                              const isNarrow = legacyNarrowIndices.includes(cellIdx);
                              return (
                                <td key={cellIdx} className="py-2.5 px-3 text-slate-700 truncate border-r border-slate-100 last:border-r-0"
                                  style={{ width: isNarrow ? 90 : 150, minWidth: isNarrow ? 90 : 150 }}
                                  title={String(cell ?? '')}>
                                  {cellIdx === 18 ? (
                                    <span className="flex items-center gap-1">
                                      {String(cell).includes('[중복 제출]') && (
                                        <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-bold text-[9px] shrink-0 border border-rose-200">중복</span>
                                      )}
                                      <span className="truncate">{String(cell).replace('[중복 제출]', '').trim()}</span>
                                    </span>
                                  ) : cellIdx === 1 ? (
                                    <span className={`font-bold ${cell === '남자' ? 'text-blue-500' : cell === '여자' ? 'text-rose-500' : ''}`}>{String(cell ?? '')}</span>
                                  ) : (
                                    String(cell !== undefined && cell !== null ? cell : '')
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
          {/* 가이드 */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-4"><HelpCircle size={15} className="text-slate-400" /> 데이터 가공 가이드</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-[11px] text-slate-600 leading-relaxed">
              <div className="space-y-1.5"><h4 className="font-bold text-slate-800 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#FF7E7E]" />기수 추출 및 이름 정제</h4><p>이름 열에서 `118기 홍길동` 형태를 분석하여 `118기`는 회차 컬럼으로, 이름은 `홍길동`으로 정제합니다.</p></div>
              <div className="space-y-1.5"><h4 className="font-bold text-slate-800 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-400" />데이터 자동 포맷팅</h4><p>성별은 `남자`/`여자`로 일치시키고, 생년월일은 `1996` 연도 형태로, 종교는 지정 키워드로 정밀 식별합니다.</p></div>
              <div className="space-y-1.5"><h4 className="font-bold text-slate-800 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" />우선순위 및 중복 정렬</h4><p>색상이 지정된 행이나 기수 포함 행을 우선순위로 배치하고, 이름 중복 시 `[중복 제출]`을 표기합니다.</p></div>
            </div>
          </div>
        </div>
      )}

      {/* 사진 미리보기 모달 */}
      {previewPhoto && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.85)' }} onClick={() => setPreviewPhoto(null)}>
          <div className="relative max-w-lg w-full mx-4" onClick={e => e.stopPropagation()}>
            <button onClick={() => setPreviewPhoto(null)} className="absolute -top-10 right-0 text-white hover:text-slate-300 transition-colors">
              <X size={24} />
            </button>
            {previewPhoto.includes('drive.google.com') ? (
              <div className="bg-white rounded-2xl p-6 text-center">
                <p className="text-sm font-bold text-slate-700 mb-3">구글 드라이브 사진 링크</p>
                <a href={previewPhoto} target="_blank" rel="noopener noreferrer"
                  className="text-violet-600 font-bold text-xs underline break-all">{previewPhoto}</a>
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewPhoto} alt="참여자 사진" className="w-full rounded-2xl shadow-2xl" onError={() => setPreviewPhoto(null)} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
