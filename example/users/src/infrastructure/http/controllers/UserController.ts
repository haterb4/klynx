import { Request, Response } from "express";
import { BaseController } from "@/core/interfaces/http/BaseController";
import { controller } from "@/decorators/controller.decorator";
import { httpDelete, httpGet, httpPost, httpPut, route } from "@/decorators/route.decorator";
import { CreateUserDTO } from "../../../application/useCases/createUser/CreateUserDTO";
import { DomainEvents } from "@/core/domain/events/DomainEvents";
import { UserService } from "../../../application/services/UserService";

@controller('/users')
export class UserController extends BaseController {
  protected executeImpl(req: Request, res: Response): Promise<void> {
    throw new Error("Method not implemented.");
  }
  private userService: UserService;

  constructor(userService: UserService) {
    super();
    this.userService = userService;
  }

  @httpPost('/')
  @httpPost('/')
  async createUser(req: Request, res: Response) {
    try {
      const createUserDTO: CreateUserDTO = {
        name: req.body.name,
        email: req.body.email
      };

      const user = await this.userService.createUser(createUserDTO);
      
      if (user.id) {
        DomainEvents.dispatchEventsForAggregate(user.id);
      }
      
      return res.status(201).json({
        success: true,
        data: {
          id: user.id?.toString(),
          name: user.name,
          email: user.email
        }
      });
    } catch (err) {
      console.error('Error creating user:', err);
      return res.status(500).json({
        success: false,
        message: err instanceof Error ? err.message : 'An error occurred while creating the user'
      });
    }
  }

  @httpGet('/:id')
  async getUserById(req: Request, res: Response) {
    try {
      const user = await this.userService.getUserById(req.params.id);
      if (!user) {
        return this.notFound(res);
      }
      return this.ok(res, user);
    } catch (err) {
      console.log(err)
      return this.fail(res, err as Error);
    }
  }

  @httpPut('/:id')
  async updateUser(req: Request, res: Response) {
    try {
      const updatedUser = await this.userService.updateUser(req.params.id, req.body);
      DomainEvents.dispatchEventsForAggregate(updatedUser.id);
      return this.ok(res, updatedUser);
    } catch (err) {
      return this.fail(res, err as Error);
    }
  }

  @httpDelete('/:id')
  async deleteUser(req: Request, res: Response) {
    try {
      await this.userService.deleteUser(req.params.id);
      return this.ok(res);
    } catch (err) {
      return this.fail(res, err as Error);
    }
  }
}