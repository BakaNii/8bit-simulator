import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Cpu, Info, Play, Square, SkipForward, AlertTriangle, CheckCircle2, Terminal } from 'lucide-react';

const OPCODES = {
  NOP: { code: 0, desc: 'No operation' },
  LDA: { code: 1, desc: 'Load memory -> A' },
  ADD: { code: 2, desc: 'Add' },
  SUB: { code: 3, desc: 'Subtract' },
  STA: { code: 4, desc: 'Store A -> Memory' },
  OUT: { code: 5, desc: 'Output A -> OUT' },
  JMP: { code: 6, desc: 'Jump to address' },
  LDI: { code: 7, desc: 'Load immediate -> A' },
  JC:  { code: 8, desc: 'Jump if carry flag' },
  HLT: { code: 15, desc: 'Halt execution' },
};

const INITIAL_PROGRAM = [
  { id: '1', mnemonic: 'LDA', operand: 4 },
  { id: '2', mnemonic: 'ADD', operand: 5 },
  { id: '3', mnemonic: 'OUT', operand: 0 },
  { id: '4', mnemonic: 'HLT', operand: 0 },
  { id: '5', mnemonic: 'DATA', operand: 14 },
  { id: '6', mnemonic: 'DATA', operand: 28 },
];

// 16-bit Simulated control signals mapping to the schematic EEPROMs
// Format: HLT | MI | RI | RO | IO | II | AI | AO || EO | SU | BI | OI | CE | CO | J | FI
const CTRL_WORDS = {
  NOP:  0x0000, 
  LDA:  0x1200, // RO, AI
  ADD:  0x12A1, // RO, AI, EO, BI, FI
  SUB:  0x12E1, // RO, AI, EO, SU, BI, FI
  STA:  0x2100, // RI, AO
  OUT:  0x0110, // AO, OI
  JMP:  0x0802, // IO, J
  LDI:  0x0A00, // IO, AI
  JC:   0x0802, // IO, J
  HLT:  0x8000, // HLT
  DATA: 0x0000,
};

const toBin = (num, bits) => {
  const val = parseInt(num) || 0;
  // Handle negative numbers or out of bounds simply by masking
  const masked = val & ((1 << bits) - 1);
  return masked.toString(2).padStart(bits, '0');
};

const SevenSegDigit = ({ val }) => {
  const patterns = {
    0: '1111110', 1: '0110000', 2: '1101101', 3: '1111001',
    4: '0110011', 5: '1011011', 6: '1011111', 7: '1110000',
    8: '1111111', 9: '1111011', off: '0000000'
  };
  const p = patterns[val !== undefined && val !== null ? val : 'off'] || patterns.off;
  const onClass = "stroke-red-500 [filter:drop-shadow(0_0_2px_#ef4444)]";
  const offClass = "stroke-red-950/20";
  
  return (
    <svg viewBox="0 0 20 34" className="w-5 h-8" strokeWidth="3" strokeLinecap="round">
      {/* a */} <line x1="5" y1="3" x2="15" y2="3" className={p[0]==='1' ? onClass : offClass} />
      {/* b */} <line x1="17" y1="5" x2="17" y2="15" className={p[1]==='1' ? onClass : offClass} />
      {/* c */} <line x1="17" y1="19" x2="17" y2="29" className={p[2]==='1' ? onClass : offClass} />
      {/* d */} <line x1="5" y1="31" x2="15" y2="31" className={p[3]==='1' ? onClass : offClass} />
      {/* e */} <line x1="3" y1="19" x2="3" y2="29" className={p[4]==='1' ? onClass : offClass} />
      {/* f */} <line x1="3" y1="5" x2="3" y2="15" className={p[5]==='1' ? onClass : offClass} />
      {/* g */} <line x1="5" y1="17" x2="15" y2="17" className={p[6]==='1' ? onClass : offClass} />
    </svg>
  );
};

const SevenSegmentDisplay = ({ value }) => {
  const strVal = value.toString().padStart(3, '0');
  return (
    <div className="flex gap-1.5 bg-neutral-950 p-2 rounded-md border-2 border-neutral-700 shadow-[inset_0_0_10px_rgba(0,0,0,1)]">
      <SevenSegDigit val={strVal[0]} />
      <SevenSegDigit val={strVal[1]} />
      <SevenSegDigit val={strVal[2]} />
    </div>
  );
};

const LED = ({ on, color = 'red', label = '', setHoverInfo }) => {
  const colors = {
    red: on ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' : 'bg-red-950',
    green: on ? 'bg-green-400 shadow-[0_0_8px_#4ade80]' : 'bg-green-950',
    blue: on ? 'bg-blue-400 shadow-[0_0_8px_#60a5fa]' : 'bg-blue-950',
    yellow: on ? 'bg-yellow-400 shadow-[0_0_8px_#facc15]' : 'bg-yellow-950',
  };
  return (
    <div 
      className={`w-3 h-3 rounded-full border border-black/80 ${colors[color]} transition-all duration-150 cursor-crosshair`}
      onMouseEnter={() => setHoverInfo && setHoverInfo(label)}
      onMouseLeave={() => setHoverInfo && setHoverInfo(null)}
    />
  );
};

const BreadboardChip = ({ title, value, bits = 8, color = 'red', manualBits, bitLabels, setHoverInfo }) => {
  const binStr = manualBits ? manualBits : toBin(value, bits);
  const pinCount = Math.max(4, Math.ceil(bits / 2));
  return (
    <div className="bg-neutral-800 border-b-4 border-neutral-900 rounded-md py-2 px-3 flex flex-col items-center gap-2 shadow-xl relative w-max mx-auto z-10">
      <div className="absolute -top-1 left-2 right-2 flex justify-between px-1">
        {Array.from({ length: pinCount }).map((_, i) => <div key={`t-${i}`} className="w-1.5 h-1.5 bg-gradient-to-b from-neutral-300 to-neutral-400 rounded-sm" />)}
      </div>
      <div className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest text-center leading-tight whitespace-nowrap">{title}</div>
      <div className="flex gap-1.5">
        {binStr.split('').map((bit, i) => {
          const bitIndex = bits - 1 - i;
          const defaultLabel = `${title} - Bit ${bitIndex}: ${bit}`;
          const label = bitLabels ? `${bitLabels[i]}: ${bit}` : defaultLabel;
          return <LED key={i} on={bit === '1'} color={color} label={label} setHoverInfo={setHoverInfo} />;
        })}
      </div>
      <div className="absolute -bottom-1 left-2 right-2 flex justify-between px-1">
        {Array.from({ length: pinCount }).map((_, i) => <div key={`b-${i}`} className="w-1.5 h-1.5 bg-gradient-to-t from-neutral-300 to-neutral-400 rounded-sm" />)}
      </div>
    </div>
  );
};

const OutRegChip = ({ value, setHoverInfo }) => {
  const binStr = toBin(value, 8);
  const pinCount = 4;
  return (
    <div className="bg-neutral-800 border-b-4 border-neutral-900 rounded-md py-2 px-3 flex flex-col items-center gap-3 shadow-xl relative w-max mx-auto z-10">
      <div className="absolute -top-1 left-2 right-2 flex justify-between px-1">
        {Array.from({ length: pinCount }).map((_, i) => <div key={`t-${i}`} className="w-1.5 h-1.5 bg-gradient-to-b from-neutral-300 to-neutral-400 rounded-sm" />)}
      </div>
      <div className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest text-center leading-tight whitespace-nowrap">OUT REG / DISPLAY</div>
      
      <SevenSegmentDisplay value={value} />
      
      <div className="flex gap-1.5 mt-1">
        {binStr.split('').map((bit, i) => (
          <LED key={i} on={bit === '1'} color="green" label={`OUT REG - Bit ${7-i}: ${bit}`} setHoverInfo={setHoverInfo} />
        ))}
      </div>
      <div className="absolute -bottom-1 left-2 right-2 flex justify-between px-1">
        {Array.from({ length: pinCount }).map((_, i) => <div key={`b-${i}`} className="w-1.5 h-1.5 bg-gradient-to-t from-neutral-300 to-neutral-400 rounded-sm" />)}
      </div>
    </div>
  );
};

export default function App() {
  const [program, setProgram] = useState(INITIAL_PROGRAM);
  const [sim, setSim] = useState({ pc: 0, ir: 0, a: 0, b: 0, alu: 0, out: 0, ctrl: 0, bus: 0, cf: false, halted: false, active: false });
  const [hoveredLed, setHoveredLed] = useState(null);

  // Reset simulator when program changes
  useEffect(() => {
    if (sim.active) {
      setSim({ pc: 0, ir: 0, a: 0, b: 0, alu: 0, out: 0, ctrl: 0, bus: 0, cf: false, halted: false, active: false });
    }
  }, [program]);

  const getMachineCode = (mnemonic, operand) => {
    if (mnemonic === 'DATA') {
      const fullBinary = toBin(operand, 8);
      return `${fullBinary.slice(0, 4)} ${fullBinary.slice(4, 8)}`;
    }
    const opBin = toBin(OPCODES[mnemonic].code, 4);
    const valBin = toBin(operand, 4);
    return `${opBin} ${valBin}`;
  };

  const getByte = (idx) => {
    if (idx >= program.length) return 0;
    const r = program[idx];
    if (r.mnemonic === 'DATA') return r.operand;
    return (OPCODES[r.mnemonic].code << 4) | r.operand;
  };

  const stepSim = () => {
    if (sim.halted) return;
    const inst = program[sim.pc];
    if (!inst) {
      setSim(s => ({ ...s, halted: true, active: true }));
      return;
    }

    // Emulate "Fetch" cycle: Load instruction byte into Instruction Register (IR)
    const irVal = getByte(sim.pc); 
    const ctrlVal = CTRL_WORDS[inst.mnemonic] || 0;
    let nextSim = { ...sim, active: true, ir: irVal, ctrl: ctrlVal };
    
    let nextProgram = [...program];
    const memVal = getByte(inst.operand);
    let busVal = 0;

    switch (inst.mnemonic) {
      case 'NOP': 
        nextSim.pc++; 
        break;
      case 'LDA': 
        nextSim.a = memVal; 
        busVal = memVal;
        nextSim.pc++; 
        break;
      case 'ADD': 
        nextSim.b = memVal; // Load value into B register
        const sum = nextSim.a + nextSim.b;
        nextSim.alu = sum & 0xFF; // ALU calculates sum
        nextSim.a = nextSim.alu;  // ALU outputs to bus, A register reads from bus
        busVal = nextSim.alu;
        nextSim.cf = sum > 0xFF;
        nextSim.pc++;
        break;
      case 'SUB': 
        nextSim.b = memVal; // Load value into B register
        const diff = nextSim.a - nextSim.b;
        nextSim.alu = (diff + 256) & 0xFF; // ALU calculates difference
        nextSim.a = nextSim.alu;
        busVal = nextSim.alu;
        nextSim.cf = nextSim.a >= nextSim.b;
        nextSim.pc++;
        break;
      case 'STA':
        if (inst.operand < 16) {
          while (nextProgram.length <= inst.operand) {
            nextProgram.push({ id: Math.random().toString(), mnemonic: 'DATA', operand: 0 });
          }
          nextProgram[inst.operand] = { ...nextProgram[inst.operand], mnemonic: 'DATA', operand: nextSim.a };
          setProgram(nextProgram);
        }
        busVal = nextSim.a;
        nextSim.pc++;
        break;
      case 'OUT':
        nextSim.out = nextSim.a;
        busVal = nextSim.a;
        nextSim.pc++;
        break;
      case 'JMP':
        nextSim.pc = inst.operand;
        busVal = inst.operand;
        break;
      case 'LDI':
        nextSim.a = inst.operand;
        busVal = inst.operand;
        nextSim.pc++;
        break;
      case 'JC':
        if (nextSim.cf) nextSim.pc = inst.operand;
        else nextSim.pc++;
        busVal = inst.operand;
        break;
      case 'HLT':
        nextSim.halted = true;
        break;
      case 'DATA':
        nextSim.pc++;
        busVal = memVal;
        break;
      default:
        nextSim.pc++;
    }

    if (nextSim.pc >= 16) nextSim.halted = true;
    nextSim.bus = busVal;
    setSim(nextSim);
  };

  const resetSim = () => {
    setSim({ pc: 0, ir: 0, a: 0, b: 0, alu: 0, out: 0, ctrl: 0, bus: 0, cf: false, halted: false, active: false });
  };

  const analyzeProgram = () => {
    const issues = [];
    let hasHlt = false;
    program.forEach((row, index) => {
      if (row.mnemonic === 'HLT') hasHlt = true;
      if (['JMP', 'JC'].includes(row.mnemonic)) {
        if (row.operand >= program.length) {
          issues.push({ type: 'error', msg: `Addr ${index}: ${row.mnemonic} jumps to uninitialized address ${row.operand}.` });
        } else if (program[row.operand].mnemonic === 'DATA') {
          issues.push({ type: 'warning', msg: `Addr ${index}: ${row.mnemonic} jumps to DATA at address ${row.operand}.` });
        }
      }
      if (['LDA', 'ADD', 'SUB'].includes(row.mnemonic)) {
        if (row.operand >= program.length) {
          issues.push({ type: 'warning', msg: `Addr ${index}: ${row.mnemonic} reads from uninitialized address ${row.operand}.` });
        } else if (program[row.operand].mnemonic !== 'DATA') {
          issues.push({ type: 'warning', msg: `Addr ${index}: ${row.mnemonic} reads from INSTRUCTION at address ${row.operand}.` });
        }
      }
      if (row.mnemonic === 'STA') {
        if (row.operand >= program.length) {
          issues.push({ type: 'warning', msg: `Addr ${index}: STA writes to uninitialized address ${row.operand}.` });
        } else if (program[row.operand].mnemonic !== 'DATA') {
          issues.push({ type: 'warning', msg: `Addr ${index}: STA overwrites INSTRUCTION at address ${row.operand}.` });
        }
      }
    });
    if (!hasHlt) {
      issues.push({ type: 'error', msg: 'Program missing HLT (Halt). Execution will continue past end.' });
    }
    return issues;
  };

  const issues = analyzeProgram();

  const addRow = () => {
    if (program.length >= 16) return;
    setProgram([...program, { id: Date.now().toString(), mnemonic: 'NOP', operand: 0 }]);
  };

  const deleteRow = (id) => {
    setProgram(program.filter((row) => row.id !== id));
  };

  const updateRow = (id, field, value) => {
    setProgram(program.map((row) => {
      if (row.id === id) {
        let newVal = value;
        // Clamp values
        if (field === 'operand') {
          const max = row.mnemonic === 'DATA' ? 255 : 15;
          newVal = Math.min(max, Math.max(0, parseInt(value) || 0));
        }
        return { ...row, [field]: newVal };
      }
      return row;
    }));
  };

  const handleMnemonicChange = (id, newMnemonic) => {
    setProgram(program.map((row) => {
      if (row.id === id) {
        // Reset operand to 0 if switching between DATA and an Instruction, to avoid overflow confusion
        const newOperand = newMnemonic === 'DATA' && row.mnemonic !== 'DATA' ? 0 
                         : newMnemonic !== 'DATA' && row.mnemonic === 'DATA' ? 0 
                         : row.operand;
        return { ...row, mnemonic: newMnemonic, operand: newOperand };
      }
      return row;
    }));
  };

  return (
    <div className="min-h-screen bg-neutral-100 p-2 md:p-4 font-mono text-neutral-800">
      <div className="max-w-7xl mx-auto space-y-4">
        
        {/* Header */}
        <div className="flex items-center space-x-3 bg-white p-4 rounded-xl shadow-sm border border-neutral-200">
          <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
            <Cpu size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-neutral-900">8-Bit Assembler</h1>
            <p className="text-neutral-500 text-xs">Interactive machine code generator (16 byte address space)</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          
          {/* Main Editor */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden flex flex-col">
            <div className="overflow-x-auto flex-grow">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-200 text-xs">
                    <th className="p-3 font-semibold text-neutral-600">Addr (Dec)</th>
                    <th className="p-3 font-semibold text-neutral-600">Instruction</th>
                    <th className="p-3 font-semibold text-neutral-600">Operand/Data</th>
                    <th className="p-3 font-semibold text-neutral-600 text-right">Addr (Bin)</th>
                    <th className="p-3 font-semibold text-neutral-600">Machine Code</th>
                    <th className="p-3 text-center font-semibold text-neutral-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 text-sm">
                  {program.map((row, index) => (
                    <tr key={row.id} className={`hover:bg-neutral-50 transition-colors ${sim.active && sim.pc === index ? 'bg-blue-50 border-l-4 border-blue-500' : 'border-l-4 border-transparent'}`}>
                      <td className="p-3 font-medium text-neutral-500">
                        <div className="flex items-center gap-2">
                          {sim.active && sim.pc === index && <SkipForward size={14} className="text-blue-600"/>}
                          {index}
                        </div>
                      </td>
                      <td className="p-3">
                        <select
                          value={row.mnemonic}
                          onChange={(e) => handleMnemonicChange(row.id, e.target.value)}
                          className="w-full p-1.5 bg-white border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          {Object.keys(OPCODES).map((op) => (
                            <option key={op} value={op}>{op}</option>
                          ))}
                          <option value="DATA">DATA</option>
                        </select>
                      </td>
                      <td className="p-4">
                        <input
                          type="number"
                          value={row.operand}
                          min="0"
                          max={row.mnemonic === 'DATA' ? "255" : "15"}
                          onChange={(e) => updateRow(row.id, 'operand', e.target.value)}
                          className="w-20 p-1.5 bg-white border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </td>
                      <td className="p-3 text-blue-600 font-medium text-right">{toBin(index, 4)}</td>
                      <td className="p-3 font-bold tracking-widest text-emerald-600">
                        {getMachineCode(row.mnemonic, row.operand)}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => deleteRow(row.id)}
                          className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete row"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {program.length === 0 && (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-neutral-400 italic">
                        No instructions. Click "Add Instruction" below to start coding.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Footer Actions */}
            <div className="p-3 bg-neutral-50 border-t border-neutral-200 flex justify-between items-center">
              <span className="text-xs text-neutral-500">
                Memory Used: <strong className={program.length === 16 ? "text-red-500" : ""}>{program.length}/16</strong> bytes
              </span>
              <button
                onClick={addRow}
                disabled={program.length >= 16}
                className="flex items-center space-x-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors shadow-sm font-medium text-xs"
              >
                <Plus size={16} />
                <span>Add Instruction</span>
              </button>
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-4">
            
            {/* Simulator Panel */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-neutral-200">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-base font-bold text-neutral-800 flex items-center gap-2">
                  <Play size={18} className="text-emerald-500" /> Simulator
                </h2>
                <div className="flex gap-1">
                  <button onClick={stepSim} disabled={sim.halted} className="p-1.5 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded disabled:opacity-50 transition-colors" title="Step (Execute Next)">
                    <SkipForward size={16} />
                  </button>
                  <button onClick={resetSim} className="p-1.5 bg-neutral-100 text-neutral-700 hover:bg-neutral-200 rounded transition-colors" title="Reset Simulator">
                    <Square size={16} />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {/* Program Counter & Instruction Register */}
                <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200">
                  <div className="text-xs text-neutral-500 font-bold mb-1 uppercase tracking-wider">Program Counter</div>
                  <div className="font-mono text-lg">{sim.pc} <span className="text-xs text-neutral-400">({toBin(sim.pc, 4)})</span></div>
                </div>
                <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200">
                  <div className="text-xs text-neutral-500 font-bold mb-1 uppercase tracking-wider">Instruction Reg</div>
                  <div className="font-mono text-lg text-purple-700 font-bold">
                    {toBin(sim.ir, 8).slice(0, 4)} {toBin(sim.ir, 8).slice(4, 8)}
                  </div>
                </div>
                
                {/* Registers A & B */}
                <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200">
                  <div className="text-xs text-neutral-500 font-bold mb-1 uppercase tracking-wider">A Register</div>
                  <div className="font-mono text-lg">{sim.a} <span className="text-xs text-neutral-400">({toBin(sim.a, 8)})</span></div>
                </div>
                <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200">
                  <div className="text-xs text-neutral-500 font-bold mb-1 uppercase tracking-wider">B Register</div>
                  <div className="font-mono text-lg">{sim.b} <span className="text-xs text-neutral-400">({toBin(sim.b, 8)})</span></div>
                </div>

                {/* Arithmetic Logic Unit */}
                <div className="col-span-2 p-3 bg-blue-50 rounded-lg border border-blue-200 flex justify-between items-center">
                  <div>
                    <div className="text-xs text-blue-600 font-bold mb-1 uppercase tracking-wider">Arithmetic Logic Unit (ALU)</div>
                    <div className="text-xs text-blue-500">Latest calculation output</div>
                  </div>
                  <div className="font-mono text-xl text-blue-800 font-bold text-right">
                    {sim.alu} <span className="text-sm font-normal text-blue-600">({toBin(sim.alu, 8)})</span>
                  </div>
                </div>

                {/* Output & Flags */}
                <div className="p-2 bg-neutral-50 rounded-lg border border-neutral-200">
                  <div className="text-[10px] text-neutral-500 font-bold mb-1 uppercase tracking-wider">Output Register</div>
                  <div className="font-mono text-sm text-emerald-600 font-bold">{sim.out} <span className="text-[10px] text-emerald-400 font-normal">({toBin(sim.out, 8)})</span></div>
                </div>
                <div className="p-2 bg-neutral-50 rounded-lg border border-neutral-200">
                  <div className="text-[10px] text-neutral-500 font-bold mb-1 uppercase tracking-wider">CPU Control Logic</div>
                  <div className="font-mono mt-1 flex gap-1">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${sim.cf ? 'bg-red-100 text-red-700 font-bold' : 'bg-neutral-200 text-neutral-500'}`} title="Carry Flag">CF</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${sim.halted ? 'bg-red-100 text-red-700 font-bold' : 'bg-neutral-200 text-neutral-500'}`} title="Halt Flag">HLT</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Program Checks / Linter */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-neutral-200">
              <h2 className="text-base font-bold text-neutral-800 flex items-center gap-2 mb-3">
                <CheckCircle2 size={18} className="text-blue-500" /> Checks
              </h2>
              {issues.length === 0 ? (
                <div className="text-xs text-emerald-700 bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                  No issues detected. Code looks good!
                </div>
              ) : (
                <ul className="space-y-1.5 max-h-32 overflow-y-auto pr-2">
                  {issues.map((issue, i) => (
                    <li key={i} className={`text-xs p-2 rounded-lg flex gap-1.5 items-start ${issue.type === 'error' ? 'bg-red-50 text-red-800 border border-red-100' : 'bg-yellow-50 text-yellow-800 border border-yellow-100'}`}>
                      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                      <span className="leading-tight">{issue.msg}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Reference Panel */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-neutral-200 hidden lg:block">
              <div className="flex items-center space-x-2 mb-4">
                <Info className="text-blue-500" size={18} />
                <h2 className="text-base font-bold text-neutral-800">Instruction Set</h2>
              </div>
              
              <div className="space-y-2">
                <div className="grid grid-cols-[2.5rem_2.5rem_1fr] gap-2 text-[10px] font-bold text-neutral-400 uppercase tracking-wider pb-1 border-b border-neutral-100">
                  <div>Code</div>
                  <div>Mne</div>
                  <div>Description</div>
                </div>
                
                {Object.entries(OPCODES).map(([mnemonic, data]) => (
                  <div key={mnemonic} className="grid grid-cols-[2.5rem_2.5rem_1fr] gap-2 text-xs items-center">
                    <div className="text-blue-600 font-medium">{toBin(data.code, 4)}</div>
                    <div className="font-bold text-neutral-700">{mnemonic}</div>
                    <div className="text-neutral-500 truncate" title={data.desc}>{data.desc}</div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* Breadboard Visualizer */}
        <div className="mt-4 p-4 md:p-6 bg-[#e5e5e5] rounded-xl border-4 border-neutral-300 shadow-inner relative overflow-x-auto overflow-y-visible" style={{ backgroundImage: 'radial-gradient(#a3a3a3 2px, transparent 2px)', backgroundSize: '16px 16px' }}>
          <div className="absolute top-0 left-0 bg-white/90 px-3 py-1.5 rounded-br-xl font-bold text-neutral-700 shadow-sm border-b border-r border-neutral-300 flex items-center gap-2 text-sm z-20">
            <Cpu size={16} className="text-blue-600" /> Live Breadboard State
          </div>
          
          <div className="relative w-full flex flex-col items-center mt-6 min-w-[750px]">
            
            {/* Top Row of Chips */}
            <div className="flex justify-center gap-8 w-full z-10">
              <BreadboardChip title="PC (ADDR)" value={sim.pc} bits={4} color="green" setHoverInfo={setHoveredLed} />
              <BreadboardChip title="INST (IR)" value={sim.ir} bits={8} color="blue" setHoverInfo={setHoveredLed} />
              <BreadboardChip 
                title="FLAGS (-,CF,-,HLT)" 
                manualBits={`0${sim.cf ? '1' : '0'}0${sim.halted ? '1' : '0'}`} 
                bits={4} 
                color="yellow" 
                bitLabels={['Unused', 'Carry Flag (CF)', 'Unused', 'Halt Flag (HLT)']}
                setHoverInfo={setHoveredLed}
              />
            </div>

            {/* The Central Bus */}
            <div className="relative w-full h-16 my-4 flex flex-col items-center justify-center z-0">
               {/* Main Bus traces */}
               <div className="absolute top-1/2 left-4 right-4 h-1 bg-blue-500/40 -translate-y-1/2 shadow-[0_0_4px_rgba(59,130,246,0.5)] rounded-full" />
               <div className="absolute top-1/2 left-4 right-4 h-3 border-y border-blue-500/20 -translate-y-1/2 rounded-full" />
               
               {/* Bus LEDs */}
               <div className="flex gap-4 relative z-10 bg-[#e5e5e5] px-6 py-2 rounded-full border-2 border-neutral-300 shadow-inner">
                 {toBin(sim.bus, 8).split('').map((bit, i) => (
                    <LED key={i} on={bit === '1'} color="blue" label={`System Bus - Bit ${7 - i}: ${bit}`} setHoverInfo={setHoveredLed} />
                 ))}
               </div>
               <div className="absolute inset-0 flex items-center justify-center text-blue-800/10 font-black text-2xl tracking-widest uppercase pointer-events-none mt-16">8-Bit System Bus</div>
            </div>

            {/* Middle Row of Chips */}
            <div className="flex justify-center gap-8 w-full z-10 items-start">
              <BreadboardChip title="A REG" value={sim.a} bits={8} color="red" setHoverInfo={setHoveredLed} />
              <BreadboardChip title="B REG" value={sim.b} bits={8} color="red" setHoverInfo={setHoveredLed} />
              <BreadboardChip title="ALU" value={sim.alu} bits={8} color="yellow" setHoverInfo={setHoveredLed} />
              
              {/* Upgraded Output Register Module */}
              <OutRegChip value={sim.out} setHoverInfo={setHoveredLed} />
            </div>

            {/* Spacer */}
            <div className="h-6 w-full"></div>

            {/* Bottom Row of Chips */}
            <div className="flex justify-center gap-8 w-full z-10 mt-2">
              <BreadboardChip 
                title="CPU CONTROL LOGIC (EEPROM MICROCODE)" 
                value={sim.ctrl} 
                bits={16} 
                color="blue" 
                setHoverInfo={setHoveredLed}
                bitLabels={[
                  'HLT: Halt clock (Stops execution)',
                  'MI: Memory Address Register In (Latches address from bus)',
                  'RI: RAM Data In (Writes bus value to RAM)',
                  'RO: RAM Data Out (Outputs RAM value to bus)',
                  'IO: Instruction Register Out (Outputs operand to bus)',
                  'II: Instruction Register In (Latches instruction from bus)',
                  'AI: A Register In (Latches value from bus)',
                  'AO: A Register Out (Outputs value to bus)',
                  'EO: ALU Result Out (Outputs ALU calculation to bus)',
                  'SU: ALU Subtract Operation (Sets ALU to subtract instead of add)',
                  'BI: B Register In (Latches value from bus)',
                  'OI: Output Register In (Latches value from bus to display)',
                  'CE: Program Counter Enable (Increments counter)',
                  'CO: Program Counter Out (Outputs address to bus)',
                  'J: Jump (Program Counter In - Latches address from bus)',
                  'FI: Flags Register In (Latches ALU condition flags)'
                ]}
              />
            </div>

            {/* Hover Info Panel */}
            <div className="mt-8 w-full max-w-4xl h-14 bg-neutral-900 rounded-lg border-4 border-neutral-700 flex items-center px-4 py-2 shadow-inner transition-colors duration-200">
              <Terminal size={20} className={hoveredLed ? "text-emerald-400 mr-3" : "text-neutral-600 mr-3"} />
              <div className="font-mono text-sm tracking-wide">
                {hoveredLed ? (
                  <span className="text-emerald-400">{hoveredLed}</span>
                ) : (
                  <span className="text-neutral-500 animate-pulse">Hover over any LED on the breadboard to view its function...</span>
                )}
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}