import React, { useEffect, useState } from 'react';
import { View, Text, Button, FlatList, StyleSheet } from 'react-native';
import { DataStore } from '@aws-amplify/datastore';
import { WatermelonDBAdapter } from 'amplify-watermelondb-adapter';
import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

// Import your DataStore models
import { Todo } from './models';

// Setup WatermelonDB
const adapter = new SQLiteAdapter({
  dbName: 'AmplifyWatermelonExample',
  jsi: true, // Enable JSI for better performance
});

const database = new Database({
  adapter,
  modelClasses: [],
});

// Configure DataStore with WatermelonDB adapter
DataStore.configure({
  storageAdapter: new WatermelonDBAdapter({
    database,
    conflictStrategy: 'ACCEPT_REMOTE',
    cacheMaxSize: 100,
    cacheTTL: 5 * 60 * 1000, // 5 minutes
  }),
});

export default function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Subscribe to Todo changes
    const subscription = DataStore.observeQuery(Todo).subscribe(
      ({ items }) => {
        setTodos(items);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const addTodo = async () => {
    try {
      await DataStore.save(
        new Todo({
          name: `Todo ${Date.now()}`,
          description: 'Created with WatermelonDB adapter',
          completed: false,
        })
      );
    } catch (error) {
      console.error('Error saving todo:', error);
    }
  };

  const toggleTodo = async (todo: Todo) => {
    try {
      await DataStore.save(
        Todo.copyOf(todo, (draft) => {
          draft.completed = !draft.completed;
        })
      );
    } catch (error) {
      console.error('Error updating todo:', error);
    }
  };

  const deleteTodo = async (todo: Todo) => {
    try {
      await DataStore.delete(todo);
    } catch (error) {
      console.error('Error deleting todo:', error);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Amplify + WatermelonDB Example</Text>
      <Button title="Add Todo" onPress={addTodo} />
      <FlatList
        data={todos}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.todoItem}>
            <Text
              style={[
                styles.todoText,
                item.completed && styles.completedText,
              ]}
              onPress={() => toggleTodo(item)}
            >
              {item.name}
            </Text>
            <Button
              title="Delete"
              onPress={() => deleteTodo(item)}
              color="red"
            />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  todoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 15,
    marginVertical: 5,
    borderRadius: 8,
  },
  todoText: {
    flex: 1,
    fontSize: 16,
  },
  completedText: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
});