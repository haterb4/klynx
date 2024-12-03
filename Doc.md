# La persistance
Voici un exemple d'utilisation :

```typescript
// Exemple de définition d'un modèle User
@table('users')
class User extends Model {
  @column({ type: 'string', unique: true })
  email: string;

  @column({ type: 'string' })
  name: string;

  @column({ type: 'boolean', default: false })
  isActive: boolean;

  @relation({
    type: 'hasMany',
    model: () => Post
  })
  posts: Post[];
}

// Exemple de définition d'un modèle Post
@table('posts')
class Post extends Model {
  @column({ type: 'string' })
  title: string;

  @column({ type: 'string' })
  content: string;

  @column({ type: 'number' })
  userId: number;

  @relation({
    type: 'belongsTo',
    model: () => User
  })
  user: User;
}

// Exemple d'utilisation dans un contrôleur
@controller('/users')
class UserController extends BaseController {
  @httpGet('/')
  async getAllUsers(req: Request, res: Response): Promise<void> {
    const users = await User.findAll({ isActive: true });
    
    // Charger les posts pour chaque utilisateur
    for (const user of users) {
      user.posts = await user.load('posts');
    }
    
    this.ok(res, users);
  }

  @httpPost('/')
  async createUser(req: Request, res: Response): Promise<void> {
    const user = new User();
    user.email = req.body.email;
    user.name = req.body.name;
    await user.save();
    
    this.created(res);
  }
}
```

Les avantages de cette approche sont :

1. **Plus direct** : Vous travaillez directement avec les modèles sans passer par des repositories ou managers
2. **Plus simple** : L'API est plus intuitive et ressemble à ce qu'on trouve dans des frameworks populaires comme Laravel
3. **Plus flexible** : Facile à étendre avec des méthodes personnalisées sur les modèles
4. **Moins de boilerplate** : Moins de code à écrire pour faire des opérations simples

Pour l'intégrer à votre framework :

1. Ajoutez la connexion à la base de données dans votre `createApp.ts` :

```typescript
// Dans createApp.ts
if (options.databaseConfig) {
  const dbConnection = new DatabaseConnection(options.databaseConfig);
  await dbConnection.connect();
  Model.setConnection(dbConnection);
}
```

## base de données et modeles
```typescript
// Exemple d'utilisation
await User.transaction(async () => {
  const user = await User.findById(1);
  const post = await Post.findById(1);
  
  user.name = 'Nouveau nom';
  post.title = 'Nouveau titre';
  
  await user.save();
  await post.save();
});

// Exemple d'utilisation
await User.transaction(async () => {
  const user = await User.findById(1);
  const post = await Post.findById(1);
  
  user.name = 'Nouveau nom';
  post.title = 'Nouveau titre';
  
  await user.save();
  await post.save();
});

// Compter les enregistrements
const count = await User.count({ role: 'admin' });

// Vérifier l'existence
const exists = await User.exists({ email: 'test@example.com' });

const user = await User.findById(1);
const posts = await user.load('posts', {
  orderBy: { created_at: 'DESC' },
  limit: 5
});

const user = await User.findById(1);
const posts = await user.load('posts', {
  orderBy: { created_at: 'DESC' },
  limit: 5
});

const user = await User.findById(1);
const posts = await user.load('posts', {
  orderBy: { created_at: 'DESC' },
  limit: 5
});


// Exemple avec User et ses magasins
const user = await User.findById('user-1');
const stores = await user.load('stores');

// Exemple avec Store et ses produits
const store = await Store.findById('store-1');
const products = await store.load('products', {
  orderBy: { price: 'DESC' },
  limit: 10
});

// Exemple avec Product et son magasin
const product = await Product.findById('product-1');
const store = await product.load('store');

```

## triggers

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';
```


# Celeron Framework Documentation

## Table of Contents
1. Models Implementation
2. Services Implementation 
3. Controllers Implementation
4. Usage Guide

## 1. Models Implementation

### Role Model
```typescript
import { column, Model, table, belongsToMany } from "celeron";
import User from "./user.model";

@table('roles')
class Role extends Model {
  @column({ type: 'string', nullable: false })
  name!: string;

  @column({ type: 'string', nullable: true })
  description?: string;

  @belongsToMany(() => User, 'user_roles')
  users?: User[];
}

export default Role;
```

### Post Model
```typescript
import { column, Model, table, belongsTo } from "celeron";
import User from "./user.model";

@table('posts')
class Post extends Model {
  @column({ type: 'string', nullable: false })
  title!: string;

  @column({ type: 'text', nullable: true })
  content?: string;

  @column({ type: 'string', nullable: false })
  user_id!: string;

  @belongsTo(() => User)
  author?: User;
}

export default Post;
```

## 2. Services Implementation

### Role Service
```typescript
import Role from '../infrastructure/persistence/models/role.model';
import { DomainEvents } from 'celeron';
import { QueryOptions } from 'celeron/dist/core/infrastructure/orm/types';

export interface RoleDTO {
  name: string;
  description?: string;
}

export class RoleService {
  async createRole(data: RoleDTO): Promise<Role> {
    const role = new Role(data);
    await role.save();
    
    if (role.id) {
      DomainEvents.dispatchEventsForAggregate(role.id);
    }

    return role;
  }

  async getRoleById(roleId: string): Promise<Role | null> {
    return Role.findById(roleId);
  }

  async getAllRoles(options: QueryOptions = {}): Promise<{ roles: Role[]; total: number }> {
    const { offset = 0, limit = 10, orderBy = { created_at: 'DESC' }, select } = options;

    let conditions = {};
    if (select) {
      conditions = {
        OR: [
          { name: { like: `%${select}%` } },
          { description: { like: `%${select}%` } }
        ]
      };
    }

    const [roles, total] = await Promise.all([
      Role.findAll(conditions, { limit, offset, orderBy }),
      Role.count(conditions)
    ]);

    return { roles: roles as Role[], total };
  }

  async updateRole(roleId: string, data: Partial<RoleDTO>): Promise<Role> {
    const role = await Role.findById(roleId);
    if (!role) {
      throw new Error('Role not found');
    }

    role.fill(data);
    await role.save();
    
    if (role.id) {
      DomainEvents.dispatchEventsForAggregate(role.id);
    }

    return role;
  }

  async deleteRole(roleId: string): Promise<void> {
    const role = await Role.findById(roleId);
    if (!role) {
      throw new Error('Role not found');
    }

    await role.delete();
  }

  async assignUserToRole(roleId: string, userId: string): Promise<void> {
    const role = await Role.findById(roleId);
    if (!role) {
      throw new Error('Role not found');
    }

    await role.getConnection().query(
      'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [userId, roleId]
    );
  }

  async removeUserFromRole(roleId: string, userId: string): Promise<void> {
    const role = await Role.findById(roleId);
    if (!role) {
      throw new Error('Role not found');
    }

    await role.getConnection().query(
      'DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2',
      [userId, roleId]
    );
  }
}
```

### Post Service
```typescript
import Post from '../infrastructure/persistence/models/post.model';
import { DomainEvents } from 'celeron';
import { QueryOptions } from 'celeron/dist/core/infrastructure/orm/types';

export interface PostDTO {
  title: string;
  content?: string;
  user_id: string;
}

export class PostService {
  async createPost(data: PostDTO): Promise<Post> {
    const post = new Post(data);
    await post.save();
    
    if (post.id) {
      DomainEvents.dispatchEventsForAggregate(post.id);
    }

    return post;
  }

  async getPostById(postId: string, includeAuthor: boolean = false): Promise<Post | null> {
    const post = await Post.findById(postId);
    if (post && includeAuthor) {
      await post.load('author');
    }
    return post;
  }

  async getAllPosts(options: QueryOptions = {}): Promise<{ posts: Post[]; total: number }> {
    const { offset = 0, limit = 10, orderBy = { created_at: 'DESC' }, select } = options;

    let conditions = {};
    if (select) {
      conditions = {
        OR: [
          { title: { like: `%${select}%` } },
          { content: { like: `%${select}%` } }
        ]
      };
    }

    const [posts, total] = await Promise.all([
      Post.findAll(conditions, { limit, offset, orderBy }),
      Post.count(conditions)
    ]);

    return { posts: posts as Post[], total };
  }

  async getUserPosts(userId: string, options: QueryOptions = {}): Promise<{ posts: Post[]; total: number }> {
    const { offset = 0, limit = 10, orderBy = { created_at: 'DESC' } } = options;
    
    const conditions = { user_id: userId };
    
    const [posts, total] = await Promise.all([
      Post.findAll(conditions, { limit, offset, orderBy }),
      Post.count(conditions)
    ]);

    return { posts: posts as Post[], total };
  }

  async updatePost(postId: string, data: Partial<PostDTO>): Promise<Post> {
    const post = await Post.findById(postId);
    if (!post) {
      throw new Error('Post not found');
    }

    post.fill(data);
    await post.save();
    
    if (post.id) {
      DomainEvents.dispatchEventsForAggregate(post.id);
    }

    return post;
  }

  async deletePost(postId: string): Promise<void> {
    const post = await Post.findById(postId);
    if (!post) {
      throw new Error('Post not found');
    }

    await post.delete();
  }
}
```

## 3. Controllers Implementation

### Role Controller
```typescript
import {
  BaseController,
  controller,
  ApiDoc,
  Delete,
  Get,
  Post as HttpPost,
  Put,
  Request,
  Response,
  UseMiddleware,
  MiddlewareGroup
} from "celeron";
import { RoleService } from "../services/role.service";
import { RateLimitMiddleware } from "../middlewares/RateLimitMiddleware";
import { AuthMiddleware } from "../middlewares/AuthMiddleware";
import { ValidationMiddleware } from "../middlewares/ValidationMiddleware";

@MiddlewareGroup('api', [new RateLimitMiddleware()])
@UseMiddleware(new AuthMiddleware())
@controller('/roles')
export class RoleController extends BaseController {
  private roleService: RoleService;

  constructor(roleService: RoleService) {
    super();
    this.roleService = roleService;
  }

  @ApiDoc({
    summary: 'Create new role',
    description: 'Creates a new role in the system',
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['name'],
            properties: {
              name: { type: 'string' },
              description: { type: 'string' }
            }
          }
        }
      }
    }
  })
  @UseMiddleware(new ValidationMiddleware())
  @HttpPost('/')
  async createRole(req: Request, res: Response) {
    try {
      const role = await this.roleService.createRole(req.body);
      return this.created(res, role);
    } catch (err) {
      console.error('Error creating role:', err);
      return this.serverError(res);
    }
  }

  @Get('/:id')
  async getRoleById(req: Request, res: Response) {
    try {
      const role = await this.roleService.getRoleById(req.params.id);
      if (!role) {
        return this.notFound(res, 'Role not found');
      }
      return this.ok(res, role);
    } catch (err) {
      return this.serverError(res);
    }
  }

  @Get('/')
  async getAllRoles(req: Request, res: Response) {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    
    try {
      const { roles, total } = await this.roleService.getAllRoles({
        offset: (page - 1) * limit,
        limit,
        select: req.query.search as [string],
        orderBy: { created_at: 'DESC' }
      });

      return this.ok(res, {
        data: roles,
        pagination: { total, page, limit }
      });
    } catch (err) {
      return this.serverError(res);
    }
  }

  @HttpPost('/:roleId/users/:userId')
  async assignUserToRole(req: Request, res: Response) {
    try {
      await this.roleService.assignUserToRole(req.params.roleId, req.params.userId);
      return this.ok(res);
    } catch (err) {
      if (err instanceof Error && err.message === 'Role not found') {
        return this.notFound(res, err.message);
      }
      return this.serverError(res);
    }
  }

  @Delete('/:roleId/users/:userId')
  async removeUserFromRole(req: Request, res: Response) {
    try {
      await this.roleService.removeUserFromRole(req.params.roleId, req.params.userId);
      return this.ok(res);
    } catch (err) {
      if (err instanceof Error && err.message === 'Role not found') {
        return this.notFound(res, err.message);
      }
      return this.serverError(res);
    }
  }
}
```

### Post Controller
```typescript
import {
  BaseController,
  controller,
  ApiDoc,
  Delete,
  Get,
  Post as HttpPost,
  Put,
  Request,
  Response,
  UseMiddleware,
  MiddlewareGroup
} from "celeron";
import { PostService } from "../services/post.service";
import { RateLimitMiddleware } from "../middlewares/RateLimitMiddleware";
import { AuthMiddleware } from "../middlewares/AuthMiddleware";
import { ValidationMiddleware } from "../middlewares/ValidationMiddleware";

@MiddlewareGroup('api', [new RateLimitMiddleware()])
@UseMiddleware(new AuthMiddleware())
@controller('/posts')
export class PostController extends BaseController {
  private postService: PostService;

  constructor(postService: PostService) {
    super();
    this.postService = postService;
  }

  @ApiDoc({
    summary: 'Create new post',
    description: 'Creates a new post in the system',
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['title', 'user_id'],
            properties: {
              title: { type: 'string' },
              content: { type: 'string' },
              user_id: { type: 'string' }
            }
          }
        }
      }
    }
  })
  @UseMiddleware(new ValidationMiddleware())
  @HttpPost('/')
  async createPost(req: Request, res: Response) {
    try {
      const post = await this.postService.createPost({
        ...req.body,
        user_id: req.user?.id || req.body.user_id
      });
      return this.created(res, post);
    } catch (err) {
      return this.serverError(res);
    }
  }

  @Get('/:id')
  async getPostById(req: Request, res: Response) {
    try {
      const includeAuthor = req.query.include_author === 'true';
      const post = await this.postService.getPostById(req.params.id, includeAuthor);
      if (!post) {
        return this.notFound(res, 'Post not found');
      }
      return this.ok(res, post);
    } catch (err) {
      return this.serverError(res);
    }
  }

  @Get('/user/:userId')
  async getUserPosts(req: Request, res: Response) {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    
    try {
      const { posts, total } = await this.postService.getUserPosts(req.params.userId, {
        offset: (page - 1) * limit,
        limit,
        orderBy: { created_at: 'DESC' }
      });

      return this.ok(res, {
        data: posts,
        pagination: { total, page, limit }
      });
    } catch (err) {
      return this.serverError(res);
    }
  }

  @Get('/')
  async getAllPosts(req: Request, res: Response) {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    
    try {
      const { posts, total } = await this.postService.getAllPosts({
        offset: (page - 1) * limit,
        limit,
        select: req.query.search as [string],
        orderBy: { created_at: 'DESC' }
      });

      return this.ok(res, {
        data: posts,
        pagination: { total, page, limit }
      });
    } catch (err) {
      return this.serverError(res);
    }
  }

  @Put('/:id')
  @UseMiddleware(new ValidationMiddleware())
  async updatePost(req: Request, res: Response) {
    try {
      const post = await this.postService.updatePost(req.params.id, req.body);
      return this.ok(res, post);
    } catch (err) {
      if (err instanceof Error && err.message === 'Post not found') {
        return this.notFound(res, err.message);
      }
      return this.serverError(res);