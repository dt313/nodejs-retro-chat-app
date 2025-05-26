import { z } from 'zod';

export const registerUser = z.object({
    email: z.string().email({ message: 'Email không hợp lệ' }),
    password: z.string().min(6, { message: 'Mật khẩu ít nhất 6 ký tự' }),
    fullName: z.string().min(1, { message: 'Tên không được để trống' }),
});

export const loginUser = z.object({
    email: z.string().email({ message: 'Email không hợp lệ' }),
    password: z.string().min(6, { message: 'Mật khẩu ít nhất 6 ký tự' }),
});

export const resetPassword = z.object({
    email: z.string().email({ message: 'Email không hợp lệ' }),
    password: z.string().min(6, { message: 'Mật khẩu ít nhất 6 ký tự' }),
});
