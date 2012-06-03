;;; brainf*ck interpreter
;;; May 2012, Kyle Miller

extern _getchar, _putchar, _fopen, _fgetc, _fclose, _printf, _feof, _exit

section .data
usage_msg db "Usage: bf filename",10,0
fopen_read db "r",0
mismatched_msg db "Too many ]'s",10,0
mismatched2_msg db "Unmatched open [.",10,0
dump_reg db "0x%llx: %s",10,0
dump_jump db "0x%llx: %s 0x%llx",10,0

s_incdp db "incdp",0
s_decdp db "decdp",0
s_inc db "inc",0
s_dec db "dec",0
s_print db "print",0
s_input db "input",0
s_jz db "jz",0
s_jnz db "jnz",0

s_ops dq 0, s_incdp, s_decdp, s_inc, s_dec
      dq s_print, s_input, s_jz, s_jnz

section .bss
file_pointer resq 1
code_area resb 8*1024*1024
data_area resb 4*1024*1024

section .text

global _main

_main:
	sub rsp, 8

	;;; if(argc < 2) print usage message
	cmp rdi, 2
	jge no_print_usage
	
	;;; printf("Usage: bf filename\n"); return
	lea rdi, [rel usage_msg]
	xor eax, eax
	call _printf
	xor eax, eax
	add rsp, 8
	ret
no_print_usage:	
	mov r13, rdi

	;;; file_pointer = fopen(argv[1], "r")
	mov rdi, [rsi + 8]
	lea rsi, [rel fopen_read]
	call _fopen
	mov [rel file_pointer], rax

	call compile

	;;; fclose(file_pointer)
	mov rdi, [rel file_pointer]
	call _fclose

	cmp r13, 2
	jle nodumpcode
	call dump_code
	xor eax, eax
	add rsp, 8
	ret
nodumpcode:
	call exec
	xor eax, eax
	add rsp, 8
	ret

compile:
	sub rsp, 8
	mov r12, rsp
	lea rbx, [rel code_area]
cloop:  mov rdi, [rel file_pointer]
	call _feof
	test rax, rax
	jnz cdone
	mov rdi, [rel file_pointer]
	call _fgetc
	cmp rax, '>'
	je c_incdp
	cmp rax, '<'
	je c_decdp
	cmp rax, '+'
	je c_inc
	cmp rax, '-'
	je c_dec
	cmp rax, '.'
	je c_print
	cmp rax, ','
	je c_input
	cmp rax, '['
	je c_oloop
	cmp rax, ']'
	je c_cloop
	jmp cloop
cdone:
	mov byte [rbx], 0

	cmp r12, rsp
	jne mismatched2	
	
	add rsp, 8
	ret

c_incdp:
	mov byte [rbx], 1
	inc rbx
	jmp cloop
c_decdp:
	mov byte [rbx], 2
	inc rbx
	jmp cloop
c_inc:
	mov byte [rbx], 3
	inc rbx
	jmp cloop
c_dec:
	mov byte [rbx], 4
	inc rbx
	jmp cloop
c_print:
	mov byte [rbx], 5
	inc rbx
	jmp cloop
c_input:
	mov byte [rbx], 6
	inc rbx
	jmp cloop
c_oloop:
	mov byte [rbx], 7
	push rbx
	add rbx, 9
	jmp cloop
c_cloop:
	mov byte [rbx], 8
	pop rax
	cmp rsp, r12
	jg mismatched
	mov r10, rax
	add r10, 9
	mov [rbx+1], r10
	mov r10, rbx
	add r10, 9
	mov [rax+1], r10
	add rbx, 9
	jmp cloop
mismatched:
	mov rsp, r12
	lea rdi, [rel mismatched_msg]
	xor eax, eax
	call _printf
	mov eax, 1
	call _exit
mismatched2:
	mov rsp, r12
	lea rdi, [rel mismatched2_msg]
	xor eax, eax
	call _printf
	mov eax, 1
	call _exit

dump_code:
	sub rsp, 8
	lea rbx, [rel code_area]
	lea r15, [rel s_ops]
.loop:	cmp byte [rbx], 0
	je dump_code.done
	cmp byte [rbx], 7
	jge dump_code.jump
	mov dl, [rbx]
	and rdx, 0xF
	mov rdx, [r15 + 8*rdx]
	mov rsi, rbx
	lea rdi, [rel dump_reg]
	xor eax, eax
	call _printf
	inc rbx
	jmp .loop
.jump:	mov rcx, [rbx+1]
	mov dl, [rbx]
	and rdx, 0xF
	mov rdx, [r15 + 8*rdx]
	mov rsi, rbx
	lea rdi, [rel dump_jump]
	xor eax, eax
	call _printf
	add rbx, 9
	jmp .loop
.done:  add rsp, 8
	ret

exec:
	sub rsp, 8
	xor ebx, ebx
	lea rbp, [rel data_area] ;; rbp is data pointer
	mov r15, rbp  		 ;; r15 is data_area
        mov r14, r15
        add r14, 4*1024*1024-1     ;; r14 is the end of data_area
	lea r12, [rel code_area] ;; r12 is code pointer
	lea r13, [rel e_table]	 ;; r13 is e_table
eloop:	mov bl, [r12]
	jmp [r13 + 8*rbx]
edone:
	add rsp, 8
	ret

e_table dq e_ret, e_incdp, e_decdp, e_inc, e_dec
	dq e_print, e_input, e_jz, e_jnz

e_ret:	jmp edone

e_incdp:
	cmp rbp, r14
	je e_incdp.noinc
	inc rbp
.noinc:
	inc r12
	jmp eloop

e_decdp:
	cmp rbp, r15
	je e_decdp.nodec
	dec rbp
.nodec:
	inc r12
	jmp eloop

e_inc:
	inc byte [rbp]
	inc r12
	jmp eloop
e_dec:
	dec byte [rbp]
	inc r12
	jmp eloop

e_print:
	mov rdi, [rbp]
	call _putchar
	inc r12
	jmp eloop
e_input:
	lea rdi, [rel stdin]
	call _feof
	test rax, rax
	jnz e_input.eof
	call _getchar
	mov [rbp], al
	inc r12
	jmp eloop
.eof:	mov byte [rbp], 0
	inc r12
	jmp eloop
stdin dq 0

e_jz:
	cmp byte [rbp], 0
	jz e_jz.dojmp
	add r12, 9
	jmp eloop
.dojmp: mov r12, [r12+1]
	jmp eloop

e_jnz:
	cmp byte [rbp], 0
	jnz e_jnz.dojmp
	add r12, 9
	jmp eloop
.dojmp: mov r12, [r12+1]
	jmp eloop
