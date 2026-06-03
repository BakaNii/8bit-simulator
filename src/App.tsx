import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Cpu, Info, Play, Square, SkipForward, AlertTriangle, CheckCircle2, Terminal, HelpCircle, X, Moon, Sun } from 'lucide-react';

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
    <div className="flex gap-1.5 bg-black p-2 rounded-md border-2 border-slate-800 shadow-[inset_0_0_15px_rgba(0,0,0,1)]">
      <SevenSegDigit val={strVal[0]} />
      <SevenSegDigit val={strVal[1]} />
      <SevenSegDigit val={strVal[2]} />
    </div>
  );
};

const LED = ({ on, color = 'red', label = '', setHoverInfo }) => {
  const colors = {
    red: on ? 'bg-red-500 shadow-[0_0_10px_#ef4444]' : 'bg-red-950',
    green: on ? 'bg-emerald-400 shadow-[0_0_10px_#34d399]' : 'bg-emerald-950',
    blue: on ? 'bg-blue-400 shadow-[0_0_10px_#60a5fa]' : 'bg-blue-950',
    yellow: on ? 'bg-amber-400 shadow-[0_0_10px_#fbbf24]' : 'bg-amber-950',
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
    <div className="bg-gradient-to-b from-slate-700 to-slate-900 border-b-4 border-slate-950 ring-1 ring-white/10 rounded-md py-2 px-3 flex flex-col items-center gap-2 shadow-2xl relative w-max mx-auto z-10 transition-transform hover:-translate-y-0.5 duration-300">
      <div className="absolute -top-1 left-2 right-2 flex justify-between px-1">
        {Array.from({ length: pinCount }).map((_, i) => <div key={`t-${i}`} className="w-1.5 h-1.5 bg-gradient-to-b from-slate-300 to-slate-500 rounded-sm shadow-sm" />)}
      </div>
      <div className="text-[9px] font-bold text-slate-300 uppercase tracking-widest text-center leading-tight whitespace-nowrap drop-shadow-md">{title}</div>
      <div className="flex gap-1.5 bg-black/20 p-1.5 rounded-full shadow-inner border border-white/5">
        {binStr.split('').map((bit, i) => {
          const bitIndex = bits - 1 - i;
          const defaultLabel = `${title} - Bit ${bitIndex}: ${bit}`;
          const label = bitLabels ? `${bitLabels[i]}: ${bit}` : defaultLabel;
          return <LED key={i} on={bit === '1'} color={color} label={label} setHoverInfo={setHoverInfo} />;
        })}
      </div>
      <div className="absolute -bottom-1 left-2 right-2 flex justify-between px-1">
        {Array.from({ length: pinCount }).map((_, i) => <div key={`b-${i}`} className="w-1.5 h-1.5 bg-gradient-to-t from-slate-300 to-slate-500 rounded-sm shadow-sm" />)}
      </div>
    </div>
  );
};

const OutRegChip = ({ value, setHoverInfo }) => {
  const binStr = toBin(value, 8);
  const pinCount = 4;
  return (
    <div className="bg-gradient-to-b from-slate-700 to-slate-900 border-b-4 border-slate-950 ring-1 ring-white/10 rounded-md py-2 px-3 flex flex-col items-center gap-3 shadow-2xl relative w-max mx-auto z-10 transition-transform hover:-translate-y-0.5 duration-300">
      <div className="absolute -top-1 left-2 right-2 flex justify-between px-1">
        {Array.from({ length: pinCount }).map((_, i) => <div key={`t-${i}`} className="w-1.5 h-1.5 bg-gradient-to-b from-slate-300 to-slate-500 rounded-sm shadow-sm" />)}
      </div>
      <div className="text-[9px] font-bold text-slate-300 uppercase tracking-widest text-center leading-tight whitespace-nowrap drop-shadow-md">OUT REG / DISPLAY</div>
      
      <SevenSegmentDisplay value={value} />
      
      <div className="flex gap-1.5 mt-1 bg-black/20 p-1.5 rounded-full shadow-inner border border-white/5">
        {binStr.split('').map((bit, i) => (
          <LED key={i} on={bit === '1'} color="green" label={`OUT REG - Bit ${7-i}: ${bit}`} setHoverInfo={setHoverInfo} />
        ))}
      </div>
      <div className="absolute -bottom-1 left-2 right-2 flex justify-between px-1">
        {Array.from({ length: pinCount }).map((_, i) => <div key={`b-${i}`} className="w-1.5 h-1.5 bg-gradient-to-t from-slate-300 to-slate-500 rounded-sm shadow-sm" />)}
      </div>
    </div>
  );
};

export default function App() {
  const [program, setProgram] = useState(INITIAL_PROGRAM);
  const [sim, setSim] = useState({ pc: 0, ir: 0, a: 0, b: 0, alu: 0, out: 0, ctrl: 0, bus: 0, cf: false, halted: false, active: false });
  const [hoveredLed, setHoveredLed] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [isDark, setIsDark] = useState(true);

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

  const boardStyle = isDark 
    ? { backgroundImage: 'radial-gradient(#1e293b 2px, transparent 2px)', backgroundSize: '16px 16px', backgroundColor: '#0f172a' }
    : { backgroundImage: 'radial-gradient(#94a3b8 2px, transparent 2px)', backgroundSize: '16px 16px', backgroundColor: '#e2e8f0' };

  return (
    <div className={`${isDark ? 'dark' : ''} min-h-screen transition-colors duration-300`}>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-2 md:p-6 font-mono text-slate-800 dark:text-slate-200 transition-colors duration-300 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-transparent via-slate-100/50 to-transparent dark:via-slate-900/20">
        
        {/* Help Instructions Modal */}
        {showHelp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md transition-opacity">
            <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden transform scale-100">
              <div className="flex justify-between items-center p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <HelpCircle className="text-blue-500" /> How to Use the Simulator
                </h2>
                <button onClick={() => setShowHelp(false)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors">
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-700 dark:text-slate-300">
                <section>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base mb-2 flex items-center gap-2">
                    <span className="bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                    Writing Assembly Code
                  </h3>
                  <ul className="list-disc pl-10 space-y-1.5 marker:text-blue-500">
                    <li><strong>Memory Limit:</strong> The architecture has 16 bytes of memory (Addresses 0-15).</li>
                    <li><strong>Instructions vs. Data:</strong> Select an instruction (e.g., <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">LDA</code>, <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">ADD</code>) from the dropdown. Use <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">DATA</code> to store raw values that your program needs to read or write.</li>
                    <li><strong>Operands:</strong> Enter the target address or immediate value in the "Operand/Data" field. Instruction operands are limited to 4 bits (0-15). <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">DATA</code> rows accept up to 8 bits (0-255).</li>
                  </ul>
                </section>

                <section>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base mb-2 flex items-center gap-2">
                    <span className="bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                    Running the Simulator
                  </h3>
                  <ul className="list-disc pl-10 space-y-1.5 marker:text-blue-500">
                    <li>Click the <strong>Step</strong> button (<SkipForward size={14} className="inline"/>) in the Simulator panel to execute your program one instruction at a time. The active row will highlight in blue.</li>
                    <li>Watch the <strong>Registers (A, B, OUT)</strong> update in real-time as calculations happen in the <strong>Arithmetic Logic Unit (ALU)</strong>.</li>
                    <li>The <strong>Carry Flag (CF)</strong> will turn on (red) if an addition exceeds 255 or a subtraction results in a borrow.</li>
                    <li>Click the <strong>Reset</strong> button (<Square size={14} className="inline"/>) to clear the registers and restart the simulation from Address 0.</li>
                  </ul>
                </section>

                <section>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base mb-2 flex items-center gap-2">
                    <span className="bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 w-6 h-6 rounded-full flex items-center justify-center text-xs">3</span>
                    The Live Breadboard
                  </h3>
                  <ul className="list-disc pl-10 space-y-1.5 marker:text-blue-500">
                    <li>Scroll to the bottom to see a live visual representation of the physical computer hardware.</li>
                    <li><strong>Hover over any LED</strong> to see a detailed explanation of what that bit or control signal means in the black terminal panel below the breadboard.</li>
                    <li>Pay close attention to the <strong>CPU Control Logic</strong> chip; it shows the active microcode signals (like <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">RO</code> for RAM Out) that dictate how data moves across the System Bus.</li>
                  </ul>
                </section>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 text-right flex justify-between items-center">
                <span className="text-xs text-slate-400 dark:text-slate-500 italic">Click outside or press X to close</span>
                <button onClick={() => setShowHelp(false)} className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg font-medium transition-all shadow-lg shadow-blue-500/30">
                  Got it, let's code!
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="max-w-7xl mx-auto space-y-6">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-xl shadow-slate-200/40 dark:shadow-none border border-slate-200 dark:border-slate-800 gap-4 transition-colors duration-300 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-500/10 to-purple-500/10 blur-3xl rounded-full pointer-events-none" />
            
            <div className="flex items-center space-x-4 z-10">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-xl shadow-lg shadow-blue-500/30 shrink-0">
                <Cpu size={28} />
              </div>
              <div>
                <h1 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300">8-Bit Assembler</h1>
                <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">Interactive machine code generator (16 byte address space)</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 w-full sm:w-auto z-10">
              <button 
                onClick={() => setIsDark(!isDark)}
                className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-all shadow-sm border border-slate-200 dark:border-slate-700"
                title="Toggle Theme"
              >
                {isDark ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              
              <button 
                onClick={() => setShowHelp(true)} 
                className="flex flex-1 sm:flex-none items-center gap-2 px-5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition-all font-medium text-sm border border-slate-200 dark:border-slate-700 shadow-sm justify-center"
              >
                <HelpCircle size={18} />
                <span>How to Use</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Main Editor */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-slate-200/40 dark:shadow-none border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col transition-colors duration-300">
              <div className="overflow-x-auto flex-grow">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-xs uppercase tracking-wider">
                      <th className="p-4 font-bold text-slate-500 dark:text-slate-400">Addr (Dec)</th>
                      <th className="p-4 font-bold text-slate-500 dark:text-slate-400">Instruction</th>
                      <th className="p-4 font-bold text-slate-500 dark:text-slate-400">Operand/Data</th>
                      <th className="p-4 font-bold text-slate-500 dark:text-slate-400 text-right">Addr (Bin)</th>
                      <th className="p-4 font-bold text-slate-500 dark:text-slate-400">Machine Code</th>
                      <th className="p-4 text-center font-bold text-slate-500 dark:text-slate-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-sm">
                    {program.map((row, index) => (
                      <tr key={row.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${sim.active && sim.pc === index ? 'bg-blue-50/50 dark:bg-blue-900/20 border-l-4 border-blue-500' : 'border-l-4 border-transparent'}`}>
                        <td className="p-4 font-medium text-slate-500 dark:text-slate-400">
                          <div className="flex items-center gap-2">
                            {sim.active && sim.pc === index && <SkipForward size={14} className="text-blue-500 dark:text-blue-400 animate-pulse"/>}
                            {index}
                          </div>
                        </td>
                        <td className="p-4">
                          <select
                            value={row.mnemonic}
                            onChange={(e) => handleMnemonicChange(row.id, e.target.value)}
                            className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:text-white transition-colors"
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
                            className="w-24 p-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:text-white transition-colors"
                          />
                        </td>
                        <td className="p-4 text-indigo-600 dark:text-indigo-400 font-medium text-right">{toBin(index, 4)}</td>
                        <td className="p-4 font-bold tracking-widest text-emerald-600 dark:text-emerald-400">
                          {getMachineCode(row.mnemonic, row.operand)}
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => deleteRow(row.id)}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Delete row"
                          >
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {program.length === 0 && (
                      <tr>
                        <td colSpan="6" className="p-8 text-center text-slate-400 italic">
                          No instructions. Click "Add Instruction" below to start coding.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Footer Actions */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Memory Used: <strong className={program.length === 16 ? "text-red-500" : "text-slate-700 dark:text-slate-200"}>{program.length}/16</strong> bytes
                </span>
                <button
                  onClick={addRow}
                  disabled={program.length >= 16}
                  className="flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-slate-400 disabled:to-slate-400 dark:disabled:from-slate-600 dark:disabled:to-slate-600 disabled:cursor-not-allowed text-white rounded-xl transition-all shadow-lg shadow-blue-500/30 disabled:shadow-none font-bold text-sm"
                >
                  <Plus size={18} />
                  <span>Add Instruction</span>
                </button>
              </div>
            </div>

            {/* Right Sidebar */}
            <div className="space-y-6">
              
              {/* Simulator Panel */}
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-xl shadow-slate-200/40 dark:shadow-none border border-slate-200 dark:border-slate-800 transition-colors duration-300">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Play size={20} className="text-emerald-500 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]" /> Simulator
                  </h2>
                  <div className="flex gap-1.5">
                    <button onClick={stepSim} disabled={sim.halted} className="p-2 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-500/30 rounded-lg disabled:opacity-50 transition-colors shadow-sm" title="Step (Execute Next)">
                      <SkipForward size={18} />
                    </button>
                    <button onClick={resetSim} className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors shadow-sm" title="Reset Simulator">
                      <Square size={18} />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {/* Program Counter & Instruction Register */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold mb-1 uppercase tracking-wider">Program Counter</div>
                    <div className="font-mono text-lg font-semibold">{sim.pc} <span className="text-xs text-slate-400 font-normal">({toBin(sim.pc, 4)})</span></div>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold mb-1 uppercase tracking-wider">Instruction Reg</div>
                    <div className="font-mono text-lg text-purple-600 dark:text-purple-400 font-bold">
                      {toBin(sim.ir, 8).slice(0, 4)} {toBin(sim.ir, 8).slice(4, 8)}
                    </div>
                  </div>
                  
                  {/* Registers A & B */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold mb-1 uppercase tracking-wider">A Register</div>
                    <div className="font-mono text-lg font-semibold">{sim.a} <span className="text-xs text-slate-400 font-normal">({toBin(sim.a, 8)})</span></div>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold mb-1 uppercase tracking-wider">B Register</div>
                    <div className="font-mono text-lg font-semibold">{sim.b} <span className="text-xs text-slate-400 font-normal">({toBin(sim.b, 8)})</span></div>
                  </div>

                  {/* Arithmetic Logic Unit */}
                  <div className="col-span-2 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800/50 flex justify-between items-center shadow-sm">
                    <div>
                      <div className="text-[10px] text-blue-600 dark:text-blue-400 font-bold mb-1 uppercase tracking-wider">Arithmetic Logic Unit (ALU)</div>
                      <div className="text-xs text-blue-500/80 dark:text-blue-400/80">Latest calculation output</div>
                    </div>
                    <div className="font-mono text-xl text-blue-700 dark:text-blue-300 font-bold text-right">
                      {sim.alu} <span className="text-sm font-normal text-blue-500 dark:text-blue-400">({toBin(sim.alu, 8)})</span>
                    </div>
                  </div>

                  {/* Output & Flags */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold mb-1 uppercase tracking-wider">Output Register</div>
                    <div className="font-mono text-lg text-emerald-600 dark:text-emerald-400 font-bold">{sim.out} <span className="text-xs text-emerald-500/70 font-normal">({toBin(sim.out, 8)})</span></div>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold mb-1 uppercase tracking-wider">CPU Control Logic</div>
                    <div className="font-mono mt-1.5 flex gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs shadow-sm ${sim.cf ? 'bg-red-500 text-white font-bold' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`} title="Carry Flag">CF</span>
                      <span className={`px-2 py-0.5 rounded text-xs shadow-sm ${sim.halted ? 'bg-red-500 text-white font-bold' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`} title="Halt Flag">HLT</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Program Checks / Linter */}
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-xl shadow-slate-200/40 dark:shadow-none border border-slate-200 dark:border-slate-800 transition-colors duration-300">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                  <CheckCircle2 size={20} className="text-blue-500" /> Checks
                </h2>
                {issues.length === 0 ? (
                  <div className="text-sm font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 p-3 rounded-xl border border-emerald-200 dark:border-emerald-500/20 shadow-sm">
                    No issues detected. Code looks good!
                  </div>
                ) : (
                  <ul className="space-y-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                    {issues.map((issue, i) => (
                      <li key={i} className={`text-xs p-3 rounded-xl flex gap-2 items-start shadow-sm border ${issue.type === 'error' ? 'bg-red-50 dark:bg-red-500/10 text-red-800 dark:text-red-300 border-red-200 dark:border-red-500/20' : 'bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-500/20'}`}>
                        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                        <span className="leading-tight font-medium">{issue.msg}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Reference Panel */}
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-xl shadow-slate-200/40 dark:shadow-none border border-slate-200 dark:border-slate-800 hidden lg:block transition-colors duration-300">
                <div className="flex items-center space-x-2 mb-5">
                  <Info className="text-blue-500" size={20} />
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Instruction Set</h2>
                </div>
                
                <div className="space-y-2.5">
                  <div className="grid grid-cols-[2.5rem_2.5rem_1fr] gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div>Code</div>
                    <div>Mne</div>
                    <div>Description</div>
                  </div>
                  
                  {Object.entries(OPCODES).map(([mnemonic, data]) => (
                    <div key={mnemonic} className="grid grid-cols-[2.5rem_2.5rem_1fr] gap-2 text-xs items-center hover:bg-slate-50 dark:hover:bg-slate-800/50 p-1 rounded-md transition-colors">
                      <div className="text-indigo-600 dark:text-indigo-400 font-bold">{toBin(data.code, 4)}</div>
                      <div className="font-bold text-slate-700 dark:text-slate-200">{mnemonic}</div>
                      <div className="text-slate-500 dark:text-slate-400 truncate" title={data.desc}>{data.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>

          {/* Breadboard Visualizer */}
          <div className="mt-6 p-3 sm:p-4 md:p-8 rounded-2xl border-4 border-slate-300 dark:border-slate-700 shadow-[inset_0_4px_12px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_4px_20px_rgba(0,0,0,0.5)] relative overflow-hidden transition-colors duration-500" style={boardStyle}>
            
            <div className="absolute top-0 left-0 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md px-3 sm:px-4 py-1.5 sm:py-2 rounded-br-2xl font-bold text-slate-800 dark:text-white shadow-md border-b border-r border-white/20 flex items-center gap-2 text-xs sm:text-sm z-20">
              <Cpu size={16} className="text-blue-600 dark:text-blue-400" /> Live Breadboard State
            </div>
            
            <div className="relative w-full flex flex-col items-center mt-10 md:mt-8">
              
              {/* Top Row of Chips */}
              <div className="flex flex-wrap justify-center gap-4 md:gap-10 w-full z-10">
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
              <div className="relative w-full py-4 md:py-6 my-4 md:my-6 flex flex-col items-center justify-center z-0">
                 {/* Main Bus traces */}
                 <div className="absolute top-1/2 left-2 sm:left-8 right-2 sm:right-8 h-1.5 bg-blue-500/60 dark:bg-blue-400/50 -translate-y-1/2 shadow-[0_0_10px_rgba(59,130,246,0.8)] rounded-full" />
                 <div className="absolute top-1/2 left-2 sm:left-8 right-2 sm:right-8 h-4 border-y border-blue-500/30 dark:border-blue-400/20 -translate-y-1/2 rounded-full" />
                 
                 {/* Bus LEDs */}
                 <div className="flex flex-wrap justify-center gap-2 sm:gap-5 relative z-10 bg-slate-200 dark:bg-slate-800 px-4 sm:px-8 py-2 sm:py-2.5 rounded-full border border-slate-300 dark:border-slate-700 shadow-lg">
                   {toBin(sim.bus, 8).split('').map((bit, i) => (
                      <LED key={i} on={bit === '1'} color="blue" label={`System Bus - Bit ${7 - i}: ${bit}`} setHoverInfo={setHoveredLed} />
                   ))}
                 </div>
                 <div className="absolute inset-0 flex items-center justify-center text-blue-900/10 dark:text-blue-200/5 font-black text-xl md:text-3xl tracking-widest md:tracking-[0.3em] uppercase pointer-events-none mt-16 md:mt-20 text-center">8-Bit System Bus</div>
              </div>

              {/* Middle Row of Chips */}
              <div className="flex flex-wrap justify-center gap-4 md:gap-10 w-full z-10 items-start">
                <BreadboardChip title="A REG" value={sim.a} bits={8} color="red" setHoverInfo={setHoveredLed} />
                <BreadboardChip title="B REG" value={sim.b} bits={8} color="red" setHoverInfo={setHoveredLed} />
                <BreadboardChip title="ALU" value={sim.alu} bits={8} color="yellow" setHoverInfo={setHoveredLed} />
                
                {/* Upgraded Output Register Module */}
                <OutRegChip value={sim.out} setHoverInfo={setHoveredLed} />
              </div>

              {/* Spacer */}
              <div className="h-4 md:h-8 w-full"></div>

              {/* Bottom Row of Chips */}
              <div className="flex flex-wrap justify-center gap-4 md:gap-10 w-full z-10 mt-2 md:mt-4 mb-2 md:mb-4">
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
              <div className="mt-6 md:mt-8 w-full max-w-4xl min-h-[4rem] bg-black/90 dark:bg-black rounded-xl border border-slate-700/50 shadow-2xl flex flex-col sm:flex-row items-center px-4 sm:px-6 py-3 backdrop-blur-md transition-colors duration-300 text-center sm:text-left gap-2 sm:gap-0">
                <Terminal size={22} className={hoveredLed ? "text-emerald-400 sm:mr-4 shrink-0 hidden sm:block" : "text-slate-600 sm:mr-4 shrink-0 hidden sm:block"} />
                <div className="font-mono text-xs sm:text-sm tracking-wide leading-relaxed w-full">
                  {hoveredLed ? (
                    <span className="text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]">{hoveredLed}</span>
                  ) : (
                    <span className="text-slate-500 animate-pulse">Tap or hover over any LED to view its specific function...</span>
                  )}
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}