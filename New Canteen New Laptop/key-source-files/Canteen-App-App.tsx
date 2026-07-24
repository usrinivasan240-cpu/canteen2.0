import React, { useContext } from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Text, View, ActivityIndicator, TouchableOpacity, Alert } from "react-native";
import { AuthProvider, AuthContext } from "./src/contexts/AuthContext";
import LoginScreen from "./src/screens/LoginScreen";
import BrowseScreen from "./src/screens/student/BrowseScreen";
import MenuScreen from "./src/screens/student/MenuScreen";
import CartScreen from "./src/screens/student/CartScreen";
import OrdersScreen from "./src/screens/student/OrdersScreen";
import OrderDetailScreen from "./src/screens/student/OrderDetailScreen";
import ReviewScreen from "./src/screens/student/ReviewScreen";
import ChefDashboard from "./src/screens/chef/ChefDashboard";
import ServerDashboard from "./src/screens/server/ServerDashboard";
import QRScannerScreen from "./src/screens/server/QRScannerScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const VIOLET = "#7c3aed";

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Browse: "🍽️",
    Menu: "🍽️",
    Orders: "📋",
    Cart: "🛒",
    Dashboard: "📊",
    Scanner: "📷",
  };
  return (
    <View style={{ alignItems: "center" }}>
      <Text style={{ fontSize: 20 }}>{icons[label] || "📌"}</Text>
      <Text
        style={{
          fontSize: 10,
          fontWeight: focused ? "700" : "500",
          color: focused ? VIOLET : "#9ca3af",
          marginTop: 2,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function LogoutButton() {
  const { logout } = useContext(AuthContext);
  return (
    <TouchableOpacity
      onPress={() => {
        Alert.alert("Logout", "Are you sure you want to logout?", [
          { text: "Cancel", style: "cancel" },
          { text: "Logout", style: "destructive", onPress: () => logout() },
        ]);
      }}
      style={{ marginRight: 16, padding: 4 }}
    >
      <Text style={{ fontSize: 20 }}>🚪</Text>
    </TouchableOpacity>
  );
}

function StudentTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: true,
        headerTitle: "Violet Bites",
        headerTitleStyle: { fontWeight: "700", color: VIOLET, fontSize: 18 },
        headerRight: () => <LogoutButton />,
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopColor: "#f3f4f6",
          height: 70,
          paddingBottom: 10,
          paddingTop: 6,
        },
        tabBarActiveTintColor: VIOLET,
        tabBarInactiveTintColor: "#9ca3af",
        tabBarLabel: () => null,
      }}
    >
      <Tab.Screen
        name="Browse"
        component={BrowseScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon label="Browse" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Orders"
        component={OrdersScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon label="Orders" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}

function ChefTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: true,
        headerTitle: "Chef Dashboard",
        headerTitleStyle: { fontWeight: "700", color: VIOLET, fontSize: 18 },
        headerRight: () => <LogoutButton />,
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopColor: "#f3f4f6",
          height: 70,
          paddingBottom: 10,
          paddingTop: 6,
        },
        tabBarActiveTintColor: VIOLET,
        tabBarInactiveTintColor: "#9ca3af",
        tabBarLabel: () => null,
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={ChefDashboard}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Dashboard" focused={focused} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

function ServerTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: true,
        headerTitle: "Server Dashboard",
        headerTitleStyle: { fontWeight: "700", color: VIOLET, fontSize: 18 },
        headerRight: () => <LogoutButton />,
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopColor: "#f3f4f6",
          height: 70,
          paddingBottom: 10,
          paddingTop: 6,
        },
        tabBarActiveTintColor: VIOLET,
        tabBarInactiveTintColor: "#9ca3af",
        tabBarLabel: () => null,
      }}
    >
      <Tab.Screen
        name="Board"
        component={ServerDashboard}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Dashboard" focused={focused} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

function AppNavigator() {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f8f3fc" }}>
        <ActivityIndicator size="large" color={VIOLET} />
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: "#fff" },
        headerTintColor: VIOLET,
        headerTitleStyle: { fontWeight: "700" },
        contentStyle: { backgroundColor: "#f8f3fc" },
      }}
    >
      {!user ? (
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
      ) : user.role === "student" ? (
        <>
          <Stack.Screen
            name="StudentTabs"
            component={StudentTabs}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="CanteenMenu"
            component={MenuScreen}
            options={{ title: "Menu" }}
          />
          <Stack.Screen
            name="Cart"
            component={CartScreen}
            options={{ title: "Your Cart" }}
          />
          <Stack.Screen
            name="OrderDetail"
            component={OrderDetailScreen}
            options={{ title: "Order Details" }}
          />
          <Stack.Screen
            name="Review"
            component={ReviewScreen}
            options={{ title: "Rate Order" }}
          />
        </>
      ) : user.role === "chef" ? (
        <Stack.Screen
          name="ChefTabs"
          component={ChefTabs}
          options={{ headerShown: false }}
        />
      ) : user.role === "staff" ? (
        <>
          <Stack.Screen
            name="ServerTabs"
            component={ServerTabs}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="QRScanner"
            component={QRScannerScreen}
            options={{ title: "Scan QR Code", headerShown: false }}
          />
        </>
      ) : (
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <AppNavigator />
        <StatusBar style="dark" />
      </NavigationContainer>
    </AuthProvider>
  );
}
