import React, { forwardRef } from 'react';
import { TextInput, type TextInputProps } from 'react-native';
import { webTextInputProps } from '../../theme/webInput';

/**
 * TextInput with mobile-web focus/touch fixes applied globally.
 * Prefer this over raw TextInput for any user-editable field.
 */
export const AppTextInput = forwardRef<TextInput, TextInputProps>(function AppTextInput(
  props,
  ref,
) {
  return <TextInput ref={ref} {...webTextInputProps(props)} />;
});
