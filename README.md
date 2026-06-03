# 8-Bit Simulator & Assembler 🖥️

Welcome to the **8-Bit Simulator**, an interactive web-based machine code generator and CPU emulator! This project is designed to help you visualize and understand how a basic 8-bit computer works at the hardware level. It features a fully functional 16-byte address space, a live breadboard visualization, and a built-in assembler.

## ✨ Features

- **Interactive Assembler:** Write your own assembly programs using a simple instruction set (LDA, ADD, SUB, STA, OUT, JMP, etc.).
- **Live Breadboard Visualization:** Watch the simulated electrical signals travel across the 8-bit system bus in real-time.
- **CPU Control Logic:** See exactly how microcode instructions manipulate registers and flags.
- **Step-by-Step Execution:** Execute your code step-by-step to debug and learn how the fetch-decode-execute cycle works.
- **Dark & Light Mode:** Beautiful UI with full dark mode support so you can code comfortably any time of day.

## 🚀 Live Demo

You can try out the live version of the simulator right away (deployed via Vercel). *(Note: Add your Vercel URL here!)*

## 🛠️ How to Run Locally

If you want to run the project on your own machine, tweak the code, or build new features, you can easily spin it up using Vite.

1. **Clone the repository:**
   ```bash
   git clone https://github.com/BakaNii/8bit-simulator.git
   cd 8bit-simulator
   ```

2. **Install dependencies:**
   Make sure you have [Node.js](https://nodejs.org/) installed, then run:
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to the local URL provided by Vite (usually `http://localhost:5173`).

## 📖 Instruction Set

The architecture uses a 4-bit opcode and a 4-bit operand. Here are the supported instructions:

| Opcode | Mnemonic | Description |
|---|---|---|
| `0000` | **NOP** | No operation |
| `0001` | **LDA** | Load memory into the A register |
| `0010` | **ADD** | Add memory value to the A register |
| `0011` | **SUB** | Subtract memory value from the A register |
| `0100` | **STA** | Store the A register into memory |
| `0101` | **OUT** | Output the A register to the display |
| `0110` | **JMP** | Jump to address |
| `0111` | **LDI** | Load immediate value into the A register |
| `1000` | **JC**  | Jump if the carry flag is set |
| `1111` | **HLT** | Halt execution |

Use the `DATA` mnemonic to define raw 8-bit values in your program.

## 🤝 Contributing

Got an idea for a new feature? Found a bug? Feel free to open an issue or submit a pull request!

## 📜 License

This project is open-source and available under the [MIT License](LICENSE).

---

*Disclaimer: This project was "vibe coded" and built with the assistance of AI. It was not made solely by me, but rather brought to life through a collaborative process!*
