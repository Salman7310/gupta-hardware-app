import React from 'react';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BillsIcon,
  DuesIcon,
  ProductsIcon,
  QuotesIcon,
  ShopIcon,
  type TabIconProps,
} from '../../src/views/components/TabIcons';
import { useOutstandingCount } from '../../src/viewmodels/useOutstandingCount';
import { headerOptions, space, theme, type } from '../../src/views/theme';

/**
 * The five places the shop returns to.
 *
 * New bill and new quotation are deliberately not among them. A document being
 * typed is work in progress held in a ViewModel, and a tab bar invites a stray
 * thumb to walk away from it; each stays an action on its own list instead.
 */
export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const outstanding = useOutstandingCount();

  return (
    <Tabs
      screenOptions={{
        ...headerOptions,
        tabBarActiveTintColor: theme.accentInk,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarLabelStyle: { ...type.micro, marginTop: 2 },
        tabBarItemStyle: { paddingVertical: space.xs },
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
          // The gesture bar sits under the tab bar on a modern Android phone.
          // Without the inset the labels are cut in half by it.
          height: 62 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: space.xs,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Products',
          tabBarIcon: (props: TabIconProps) => <ProductsIcon {...props} />,
        }}
      />
      <Tabs.Screen
        name="bills"
        options={{
          title: 'Bills',
          tabBarIcon: (props: TabIconProps) => <BillsIcon {...props} />,
        }}
      />
      <Tabs.Screen
        name="quotes"
        options={{
          title: 'Quotes',
          tabBarIcon: (props: TabIconProps) => <QuotesIcon {...props} />,
        }}
      />
      <Tabs.Screen
        name="dues"
        options={{
          title: 'Dues',
          tabBarIcon: (props: TabIconProps) => <DuesIcon {...props} />,
          // The count, not the amount: a badge has room for a number, and
          // "how many people owe me" is the glance this is for.
          tabBarBadge: outstanding > 0 ? outstanding : undefined,
          tabBarBadgeStyle: { backgroundColor: theme.danger, color: theme.accentText },
        }}
      />
      <Tabs.Screen
        name="shop"
        options={{
          title: 'Shop',
          tabBarIcon: (props: TabIconProps) => <ShopIcon {...props} />,
        }}
      />
    </Tabs>
  );
}
