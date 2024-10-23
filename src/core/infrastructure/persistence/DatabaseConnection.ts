import mongoose from 'mongoose';
import { AwilixContainer, Resolver } from 'awilix';

export class DatabaseConnection implements Resolver<any> {
  private readonly url: string;
  private readonly options: any;

  constructor(url: string, options?: any) {
    this.url = url;
    this.options = options || {
      useNewUrlParser: true,
      useUnifiedTopology: true
    };
  }

  public async connect(): Promise<void> {
    try {
      await mongoose.connect(this.url, this.options);
      console.log('Database connected successfully');
    } catch (error) {
      console.error('Database connection error:', error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    await mongoose.disconnect();
    console.log('Database disconnected successfully');
  }

  resolve<U extends object>(container: AwilixContainer<U>): any {
    return this;
  }
}
